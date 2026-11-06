const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const evidenceDir = path.join(__dirname, "..", "test-evidence");
fs.mkdirSync(evidenceDir, { recursive: true });

(async function runTests() {
  const options = new chrome.Options();
  options.addArguments("--start-maximized", "--disable-notifications");
  const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  let passed = 0, failed = 0;

  async function screenshot(name) {
    const image = await driver.takeScreenshot();
    fs.writeFileSync(path.join(evidenceDir, `${name}.png`), image, "base64");
  }
  async function testCase(name, fn) {
    try {
      await fn();
      await screenshot(name);
      console.log(`PASS ${name}`);
      passed++;
    } catch (error) {
      console.error(`FAIL ${name}: ${error.message}`);
      try { await screenshot(`${name}-failure`); } catch {}
      failed++;
    }
  }
  async function login() {
    await driver.get(BASE_URL);
    await driver.wait(until.elementLocated(By.id("loginForm")), 10000);
    await driver.findElement(By.id("username")).clear();
    await driver.findElement(By.id("username")).sendKeys("faculty");
    await driver.findElement(By.id("password")).clear();
    await driver.findElement(By.id("password")).sendKeys("faculty123");
    await driver.findElement(By.id("loginBtn")).click();
    await driver.wait(until.elementIsVisible(driver.findElement(By.id("appPanel"))), 10000);
  }
  async function tab(id) {
    await driver.findElement(By.css(`[data-tab="${id}"]`)).click();
    await driver.wait(until.elementIsVisible(driver.findElement(By.id(id))), 5000);
  }

  try {
    await testCase("TC01-Faculty-Login", async () => {
      await login();
      const status = await driver.findElement(By.id("status")).getText();
      if (!status.includes("Login successful")) throw new Error("Login message missing");
    });

    await testCase("TC02-Add-Student", async () => {
      await tab("studentsSection");
      const suffix = Date.now();
      await driver.findElement(By.id("rollNo")).sendKeys(`AUTO${suffix}`);
      await driver.findElement(By.id("studentName")).sendKeys("Selenium Test Student");
      await driver.findElement(By.id("studentEmail")).sendKeys(`auto${suffix}@example.com`);
      await driver.findElement(By.id("addStudentBtn")).click();
      await driver.wait(async () => (await driver.findElement(By.id("status")).getText()).includes("Student added"), 10000);
      const rows = await driver.findElements(By.css("#studentsBody tr"));
      if (!rows.length) throw new Error("Student list is empty");
    });

    await testCase("TC03-Mark-Attendance", async () => {
      await tab("attendanceSection");
      await driver.findElement(By.id("loadAttendanceBtn")).click();
      const selects = await driver.findElements(By.css("#attendanceBody select"));
      if (!selects.length) throw new Error("No students available for attendance");
      await driver.findElement(By.id("saveAttendanceBtn")).click();
      await driver.wait(async () => (await driver.findElement(By.id("status")).getText()).includes("Attendance"), 10000);
    });

    await testCase("TC04-Update-Attendance", async () => {
      await tab("attendanceSection");
      const first = driver.findElement(By.css("#attendanceBody select"));
      await first.click();
      await first.findElement(By.css('option[value="Absent"]')).click();
      await driver.findElement(By.id("saveAttendanceBtn")).click();
      await driver.wait(async () => (await driver.findElement(By.id("status")).getText()).includes("Attendance"), 10000);
    });

    await testCase("TC05-Calculate-Attendance-Percentage", async () => {
      await tab("attendanceSection");
      await driver.findElement(By.id("refreshSummaryBtn")).click();
      await driver.wait(async () => (await driver.findElement(By.id("summaryBody")).getText()).length > 0, 10000);
    });

    await testCase("TC06-Enter-Internal-Marks", async () => {
      await tab("marksSection");
      await driver.findElement(By.id("subject")).sendKeys("Selenium Testing");
      await driver.findElement(By.id("internal1")).sendKeys("80");
      await driver.findElement(By.id("internal2")).sendKeys("90");
      await driver.findElement(By.id("semester")).sendKeys("50");
      await driver.findElement(By.id("assignment")).sendKeys("8");
      await driver.findElement(By.id("saveMarksBtn")).click();
      await driver.wait(async () => (await driver.findElement(By.id("status")).getText()).includes("Marks saved"), 10000);
    });

    await testCase("TC07-Generate-Performance-Report", async () => {
      await tab("reportsSection");
      await driver.findElement(By.id("generateReportBtn")).click();
      await driver.wait(async () => (await driver.findElement(By.id("reportOutput")).getText()).includes("Attendance:"), 10000);
    });
  } finally {
    console.log("\n========== SELENIUM TEST SUMMARY ==========");
    console.log(`Total test cases: ${passed + failed}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Screenshots: ${evidenceDir}`);
    await driver.quit();
    if (failed) process.exitCode = 1;
  }
})();
