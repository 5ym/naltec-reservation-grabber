const fs = require("fs");
const chrome = require("selenium-webdriver/chrome");
const { Builder, Browser, By, until } = require("selenium-webdriver");

async function main() {
  
  const [id, password, chassis] = fs
  .readFileSync("parameter.txt","utf8")
  .split(/\r?\n/)
  .map(v => v.trim());
  
  const options = new chrome.Options();

  // options.addArguments("--headless=new");
  options.addArguments("--window-size=1920,1080");
  options.addArguments("--disable-gpu");
  options.addArguments("--no-sandbox");
  const driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
  
  try {
    
    console.log("実行:", new Date());
    
    await driver.get("https://www.reserve.naltec.go.jp/web/ap-entry?slinky___page=forward:slinkyLogin");
    await driver.findElement(By.name("account_id")).sendKeys(id);
    await driver.findElement(By.name("password")).sendKeys(password);
    await driver.findElement(By.css('button[type="submit"]')).click();
    await driver.wait(until.urlContains("A1021_01"),10000);
    
    await driver.get("https://www.reserve.naltec.go.jp/web/ap-entry?slinky___page=forward:A1101_01");
    await driver.findElement(By.id("insp_type_5")).click(); // 1継続,5構変
    await driver.findElement(By.id("insp_vehicle_class_1")).click();
    await driver.findElement(By.css('button[type="submit"]')).click();
    
    // 事務所一覧が表示されるのを待つ
    const location = await driver.wait(
      until.elementLocated(By.css('button[value="Forward:A1101_03,office=41"]')),
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
        By.css('button[data-topagename="A1101_04"]')
      );
      if (!available.length) return;
      await available.at(-1).click();
    }
    
    // 車両情報入力画面が出るのを待つ
    const chassisInput = await driver.wait(
      until.elementLocated(By.name("chassis_no")),
      10000
    );
    await driver.wait(until.elementIsVisible(chassisInput), 10000);
    chassisInput.sendKeys(chassis);
    await driver.findElement(By.id("compliance_check")).click();
    // 早すぎると画像認証が表示されるため少し待つ1.8秒
    await driver.sleep(1800);
    await driver.findElement(By.css('button[data-topagename="A1101_05"]')).click();

    // 予約内容確認画面が表示されるのを待つ
    const confirmButton = await driver.wait(
      until.elementLocated(By.css('button[data-topagename="A1101_06"]')),
      10000
    );
    confirmButton.click();
    
  } catch (error) {
    console.error(error);
  } finally {
    await driver.quit();
  }
};
main();
setInterval(main, 60 * 1000);