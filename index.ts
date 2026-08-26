// Docker コンテナ内でのみ実行を許可する
const inDocker =
  process.env.RUNNING_IN_DOCKER === "1" ||
  (await Bun.file("/.dockerenv").exists()) ||
  (await Bun.file("/run/.containerenv").exists());
if (!inDocker) {
  console.error("このツールは Docker コンテナ内でのみ実行できます。");
  console.error("compose.override.yml.example を compose.override.yml にコピーして値を設定し、`docker compose up --build` で起動してください。");
  process.exit(1);
}

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`環境変数 ${name} が設定されていません。compose.override.yml で指定してください。`);
    process.exit(1);
  }
  return value;
};

const id = requireEnv("NALTEC_ID");
const password = requireEnv("NALTEC_PASSWORD");
const chassis = requireEnv("CHASSIS_NO");
const month = Number(requireEnv("TARGET_MONTH"));
const day = Number(requireEnv("TARGET_DAY"));
// 検査種別 1:継続検査 2:中古新規 3:新車新規 4:その他新規 5:構造変更
const inspTypeNumber = requireEnv("INSP_TYPE");
// 予約画面において表示されるnaltec事務所のボタン要素の番号 (42:袖ヶ浦)
const locationNumber = process.env.LOCATION_NUMBER?.trim() || "41";
const specifiedRound = Number(process.env.ROUND?.trim() || "1");
// 車両タイプ 1:普通車 2:中型大型 3:大型特殊
const vehicleClass = process.env.VEHICLE_CLASS?.trim() || "1";
const intervalSeconds = Number(process.env.INTERVAL_SECONDS?.trim() || "30");

let shouldStop = false;

const convertToDateObj = (dateStr: string): Date => {
  const match = dateStr.match(/(\d{4})年[\s　]*(\d{1,2})月[\s　]*(\d{1,2})日/);
  if (!match) throw new Error(`日付を解釈できません: ${dateStr}`);

  const [, year, monthStr, dayStr] = match;
  return new Date(Number(year), Number(monthStr) - 1, Number(dayStr));
};

// ページ内で XPath の最初の一致要素を返す式
const xpNode = (xp: string) =>
  `document.evaluate(${JSON.stringify(xp)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
// ページ内で XPath の一致数を返す式
const xpCount = (xp: string) =>
  `document.evaluate(${JSON.stringify(`count(${xp})`)}, document, null, XPathResult.NUMBER_TYPE, null).numberValue`;

// 式が truthy を返すまでポーリングして待つ (ナビゲーション中の evaluate 失敗は無視して再試行)
const waitFor = async <T>(view: InstanceType<typeof Bun.WebView>, expr: string, timeoutMs = 10000): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const result = await view.evaluate<T>(expr);
      if (result) return result;
    } catch {}
    if (Date.now() > deadline) throw new Error(`タイムアウト: ${expr}`);
    await Bun.sleep(100);
  }
};

const MARK = "data-grabber-target";

// XPath で見つけた要素に印を付けてからネイティブクリックする
const clickXPath = async (view: InstanceType<typeof Bun.WebView>, xp: string, timeoutMs = 10000) => {
  await waitFor(view, `${xpCount(xp)} > 0`, timeoutMs);
  await view.evaluate(`(() => {
    document.querySelectorAll('[${MARK}]').forEach(el => el.removeAttribute('${MARK}'));
    ${xpNode(xp)}.setAttribute('${MARK}', '1');
  })()`);
  await view.click(`[${MARK}="1"]`, { timeout: timeoutMs });
};

const getXPathText = async (view: InstanceType<typeof Bun.WebView>, xp: string): Promise<string> => {
  const text = await view.evaluate<string | null>(`(${xpNode(xp)})?.textContent ?? null`);
  if (text === null) throw new Error(`要素が見つかりません: ${xp}`);
  return text.trim();
};

async function main() {
  const nowDate = new Date();
  const specifiedDate = new Date(nowDate.getFullYear(), month - 1, day);
  const dateLabel = `${specifiedDate.getMonth() + 1}月${specifiedDate.getDate()}日`;

  const view = new Bun.WebView({
    width: 1920,
    height: 1080,
    backend: {
      type: "chrome",
      argv: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--lang=ja-JP"],
    },
    dataStore: "ephemeral",
  });

  try {
    console.log("実行:", new Date());
    // ログイン
    await view.navigate("https://www.reserve.naltec.go.jp/web/ap-entry?slinky___page=forward:slinkyLogin");
    await view.click('input[name="account_id"]', { timeout: 10000 });
    await view.type(id);
    await view.click('input[name="password"]', { timeout: 10000 });
    await view.type(password);
    await view.click('button[type="submit"]', { timeout: 10000 });

    // 予約画面
    await waitFor(view, `!!document.querySelector('a[data-topagename="A1101_01"]')`);
    // 予約済みの場合変更画面へ行く
    const reservedXp = `//tr[td[5][contains(text(),"${chassis}")]]//button`;
    const hasReservation = await view.evaluate<number>(xpCount(reservedXp)) > 0;
    let examDate: Date | undefined, round: number | undefined;
    if (hasReservation) {
      await clickXPath(view, reservedXp);
      await waitFor(view, `!!document.querySelector('button[value="Forward:A1131_01"]')`);
      examDate = convertToDateObj(
        await getXPathText(view, '//th[normalize-space(.)="受検日"]/following-sibling::td')
      );
      round = parseInt(
        (await getXPathText(view, '//th[normalize-space(.)="ラウンド"]/following-sibling::td')).replace(/\D/g, "")
      );
      if (examDate.getTime() === specifiedDate.getTime() && round === specifiedRound) {
        console.log("希望日で予約が取得済みです");
        shouldStop = true;
        return;
      }
      await view.click('button[value="Forward:A1131_01"]', { timeout: 10000 });
    } else {
      await view.click('a[data-topagename="A1101_01"]', { timeout: 10000 });
    }

    // 種別画面
    await view.click(`#insp_type_${inspTypeNumber}`, { timeout: 10000 });
    await view.click(`#insp_vehicle_class_${vehicleClass}`, { timeout: 10000 });
    await clickXPath(view, "(//button)[last()]");

    // 事務所一覧が表示されるのを待って選択
    await view.click(`button[value$="office=${locationNumber}"]`, { timeout: 10000 });

    // 予約時間選択画面が表示されるのを待つ
    await waitFor(view, `${xpCount("//tr[th[contains(text(),'検査時間')]]")} > 0`);
    const specifiedXp = `//tr[th[contains(text(),'${dateLabel}')]]/td[${specifiedRound}]//button`;
    const specifiedCount = await view.evaluate<number>(xpCount(specifiedXp));
    if (specifiedCount > 0) {
      await clickXPath(view, specifiedXp);
    } else {
      // 希望のラウンドが取れない場合、同じ日の他のラウンドが取れないか確認する
      const sameDateXp = `//tr[th[contains(text(),'${dateLabel}')]]//button`;
      const sameDateCount = await view.evaluate<number>(xpCount(sameDateXp));
      if (sameDateCount > 0) {
        await clickXPath(view, sameDateXp);
      } else {
        return;
      }
    }

    // 予約変更の場合次のボタンが表示されるまでまつ、予約の場合は車両情報入力画面が出るのを待つ
    if (hasReservation) {
      await waitFor(view, `!!document.querySelector('button[value^="Forward"]')`);
      const afterDate = convertToDateObj(
        await getXPathText(view, '//th[normalize-space(.)="受検日"]/following-sibling::td')
      );
      const afterRoundNum = parseInt(
        (await getXPathText(view, '//th[normalize-space(.)="ラウンド"]/following-sibling::td')).replace(/\D/g, "")
      );
      // 希望日が選択できたが、既存の予約と同一だったら終了する
      const isSame = examDate!.getTime() === afterDate.getTime() && round === afterRoundNum;
      const isOlder = round! < afterRoundNum;
      // 以前の予約と同じもしくは先のラウンドだったらスキップ
      if (specifiedCount === 0 && (isSame || isOlder)) {
        return;
      }
    } else {
      // 車両情報入力画面が出るのを待つ
      await view.click('input[name="chassis_no"]', { timeout: 10000 });
      await view.type(chassis);
      await view.click("#compliance_check", { timeout: 10000 });
    }
    await view.click('button[value^="Forward"]', { timeout: 10000 });

    // 予約内容確認画面が表示されるのを待つ
    await waitFor(view, `!!document.querySelector('button[value^="Forward"]')`);
    // 画像認証が出た場合bot判定が消えるまでリロードする
    for (let i = 0; i < 20; i++) {
      const hasImageAuth = await view.evaluate<boolean>(`!!document.querySelector('[name="image_auth"]')`);
      if (!hasImageAuth) {
        // 画像認証が無ければ抜ける
        break;
      }
      console.log(`画像認証検出: ${i + 1}回目 リロードします`);
      await view.reload();
      // ページ読み込み待ち
      await Bun.sleep(100);
    }
    // クリック前にもう一度確認ボタンがあるか確認する
    await view.click('button[value^="Forward"]', { timeout: 10000 });
    await waitFor(view, `${xpCount('//span[contains(text(),"予約番号")]')} > 0`);

    // 最後に希望日で予約が取れていれば定期実行を終了する
    if (specifiedCount > 0) {
      console.log("希望日で予約が取れました！");
      shouldStop = true;
    }
  } catch (error) {
    console.error(error);
  } finally {
    view.close();
    console.log("終了:", new Date());
  }
}

async function loop() {
  while (!shouldStop) {
    await main();
    if (shouldStop) break;

    await Bun.sleep(intervalSeconds * 1000);
  }

  console.log("ループ終了");
  process.exit(0);
}

loop();

export {};
