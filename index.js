const fs = require('fs');
const { Builder, Browser, By, until } = require('selenium-webdriver');

(async function main() {
    const data = fs.readFileSync('parameter.txt', 'utf8').split('\n');
    const id = data[0].trim();
    const password = data[1].trim();
    const chassis_number = data[2].trim();

    let driver = await new Builder().forBrowser(Browser.CHROME).build();

    await driver.get('https://www.reserve.naltec.go.jp/web/ap-entry?slinky___page=forward:slinkyLogin');
    
    await driver.findElement(By.name('account_id')).sendKeys(id);
    await driver.findElement(By.name('password')).sendKeys(password);
    await driver.findElement(By.css('button[type="submit"]')).click();
    await driver.wait(until.urlContains('/web/ap-entry?slinky___page=forward:A1021_01'), 10000);
    await driver.get('https://www.reserve.naltec.go.jp/web/ap-entry?slinky___page=forward:A1101_01');
    // 1 継続検査 5 構造等変更検査
    await driver.findElement(By.id('insp_type_5')).click();
    // 1 普通車 2 中型車,大型車
    await driver.findElement(By.id('insp_vehicle_class_1')).click();
    await driver.findElement(By.css('button[type="submit"]')).click();
    // A1101_03 袖ヶ浦
    await driver.findElement(By.css('button[data-topagename="A1101_03"]')).click();

    // 指定の日を選択するなければ取れる一番遠い日付けを選択する
    const specified_elements = await driver.findElements(
        By.xpath("//tr[th[contains(text(),'3月23日')]]/td[1]//button")
    );
    if (specified_elements.length > 0) {
        await specified_elements[0].click();
    } else {
        // 画面内で選択可能な一番未来を選択する
        const available_elements = await driver.findElements(By.css('button[data-topagename="A1101_04"]'));
        if (available_elements.length > 0) {
            const lastElement = available_elements[available_elements.length - 1];
            await lastElement.click();
        } else {
            await driver.quit();
            return;
        }
    }

    await driver.findElement(By.name('chassis_no')).sendKeys(chassis_number);
    await driver.findElement(By.id('compliance_check')).click();
    await driver.findElement(By.css('button[data-topagename="A1101_05"]')).click();
    await driver.findElement(By.css('button[data-topagename="A1101_06"]')).click();

    await driver.quit();
})();
