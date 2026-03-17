const fs = require("fs");
const chrome = require("selenium-webdriver/chrome");
const { Builder, Browser, By, until } = require("selenium-webdriver");

async function main() {
  // 事務所番号42:袖ヶ浦
  const locationNumber = '41'
  
  const [id, password, chassis] = fs
  .readFileSync("parameter.txt","utf8")
  .split(/\r?\n/)
  .map(v => v.trim());
  
  const options = new chrome.Options();

  options.addArguments("--headless=new");
  options.addArguments("--window-size=1920,1080");
  options.addArguments("--disable-gpu");
  options.addArguments("--no-sandbox");
  const driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
  
  try {
    console.log("実行:", new Date());
    // ログイン
    await driver.get("https://www.reserve.naltec.go.jp/web/ap-entry?slinky___page=forward:slinkyLogin");
    await driver.findElement(By.name("account_id")).sendKeys(id);
    await driver.findElement(By.name("password")).sendKeys(password);
    await driver.findElement(By.css('button[type="submit"]')).click();
    
    // 予約画面
    const reserveButton = await driver.wait(
      until.elementLocated(By.css('a[data-topagename="A1101_01"]')),
      10000
    );
    // 予約済みの場合変更画面へ行く
    const reservedButton = await driver.findElements(
      By.xpath(`//tr[td[5][contains(text(),"${chassis}")]]//button`)
    );
    let examDate, round;
    if (reservedButton.length) {
      await reservedButton[0].click();
      const chnageButton = await driver.wait(
        until.elementLocated(By.css('button[value="Forward:A1131_01"]')),
        10000
      )
      examDate = await driver.findElement(By.xpath(
        '//th[normalize-space(.)="受検日"]/following-sibling::td'
      )).getText();
      round = await driver.findElement(By.xpath(
        '//th[normalize-space(.)="ラウンド"]/following-sibling::td'
      )).getText();
      chnageButton.click();
    } else {
      reserveButton.click();
    }

    // 種別画面
    const inspectionType = await driver.wait(
      until.elementLocated(By.id("insp_type_4")), // 1継続,4構変
      10000
    );
    inspectionType.click();
    await driver.findElement(By.id("insp_vehicle_class_1")).click();
    await driver.findElement(By.xpath('(//button)[last()]')).click();
    
    // 事務所一覧が表示されるのを待つ
    const location = await driver.wait(
      until.elementLocated(By.css(`button[value$="office=${locationNumber}"]`)),
      10000
    );
    location.click();

    // 予約時間選択画面が表示されるのを待つ
    await driver.wait(
      until.elementLocated(By.xpath("//tr[th[contains(text(),'検査時間')]]")),
      10000
    );
    const specified = await driver.findElements(
      By.xpath("//tr[th[contains(text(),'3月30日')]]/td[1]//button")
    );
    if (specified.length) {
      await specified[0].click();
    } else {
      const available = await driver.findElements(
        By.css('button[value^="Forward"]')
      );
      if (!available.length) return;
      await available.at(-1).click();
    }
    
    // 予約変更の場合次のボタンが表示されるまでまつ、予約の場合は車両情報入力画面が出るのを待つ
    if (reservedButton.length) {
      await driver.wait(
        until.elementLocated(By.css('button[value^="Forward"]')),
        10000
      );
      const afterExamDate = await driver.findElement(By.xpath(
        '//th[normalize-space(.)="受検日"]/following-sibling::td'
      )).getText();
      const afterRound = await driver.findElement(By.xpath(
        '//th[normalize-space(.)="ラウンド"]/following-sibling::td'
      )).getText();
      if (examDate === afterExamDate && round === afterRound) {
        return;
      }
    } else {
      // 車両情報入力画面が出るのを待つ
      const chassisInput = await driver.wait(
        until.elementLocated(By.name("chassis_no")),
        10000
      );
      await driver.wait(until.elementIsVisible(chassisInput), 10000);
      chassisInput.sendKeys(chassis);
      await driver.findElement(By.id("compliance_check")).click();
    }
    await driver.findElement(By.css('button[value^="Forward"]')).click();

    // 予約内容確認画面が表示されるのを待つ
    await driver.wait(
      until.elementLocated(By.css('button[value^="Forward"]')),
      10000
    );
    // 画像認証が出た場合bot判定が消えるまでリロードする
    for (let i = 0; i < 20; i++) {
      const imageAuth = await driver.findElements(By.name("image_auth"));
      if (!imageAuth.length) {
        // 画像認証が無ければ抜ける
        break;
      }
      console.log(`画像認証検出: ${i + 1}回目 リロードします`);
      await driver.navigate().refresh();
      // ページ読み込み待ち
      await driver.sleep(100);
    }
    // クリック前にもう一度確認ボタンがあるか確認する
    const lastConfirmButton = await driver.wait(
      until.elementLocated(By.css('button[value^="Forward"]')),
      10000
    );
    lastConfirmButton.click();
    await driver.wait(
      until.elementLocated(By.xpath('//span[contains(text(),"予約番号")]')),
      10000
    );
  } catch (error) {
    console.error(error);
  } finally {
    await driver.quit();
  }
};
main();
setInterval(main, 60 * 1000);