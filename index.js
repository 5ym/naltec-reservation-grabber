const fs = require("fs");
const chrome = require("selenium-webdriver/chrome");
const { Builder, Browser, By, until } = require("selenium-webdriver");

async function main() {
  
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
    
    await driver.get("https://www.reserve.naltec.go.jp/web/ap-entry?slinky___page=forward:slinkyLogin");
    
    await driver.findElement(By.name("account_id")).sendKeys(id);
    await driver.findElement(By.name("password")).sendKeys(password);
    await driver.findElement(By.css('button[type="submit"]')).click();
    
    await driver.wait(until.urlContains("A1021_01"),10000);
    
    await driver.get("https://www.reserve.naltec.go.jp/web/ap-entry?slinky___page=forward:A1101_01");
    
    await driver.findElement(By.id("insp_type_5")).click();
    await driver.findElement(By.id("insp_vehicle_class_1")).click();
    await driver.findElement(By.css('button[type="submit"]')).click();
    
    await driver.findElement(By.css('button[value="Forward:A1101_03,office=41"]')).click();
    
    const specified = await driver.findElements(
      By.xpath("//tr[th[contains(text(),'3月23日')]]/td[1]//button")
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
    
    await driver.findElement(By.name("chassis_no")).sendKeys(chassis);
    await driver.findElement(By.id("compliance_check")).click();
    await driver.findElement(By.css('button[data-topagename="A1101_05"]')).click();
    await driver.findElement(By.css('button[data-topagename="A1101_06"]')).click();
    
  } catch (error) {
    console.error(error);
  } finally {
    await driver.quit();
  }
};
main();
setInterval(main, 60 * 1000);