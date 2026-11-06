
const { Builder, By, until, Select } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:3003";
const evidenceDir = path.join(__dirname, "..", "test-evidence");

fs.mkdirSync(evidenceDir, { recursive: true });

(async function runTests() {
    const options = new chrome.Options();

    options.addArguments(
        "--start-maximized",
        "--disable-notifications",
        "--disable-save-password-bubble",
        "--disable-features=PasswordLeakDetection,PasswordCheck,PasswordManagerOnboarding"
    );

    options.setUserPreferences({
        "credentials_enable_service": false,
        "profile.password_manager_enabled": false,
        "profile.password_manager_leak_detection": false
    });

    const driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(options)
        .build();

    let passed = 0;
    let failed = 0;

    async function screenshot(name) {
        const image = await driver.takeScreenshot();
        fs.writeFileSync(
            path.join(evidenceDir, `${name}.png`),
            image,
            "base64"
        );
    }

    async function testCase(name, fn) {
        try {
            await fn();
            await screenshot(name);
            console.log(`PASS ${name}`);
            passed++;
        } catch (error) {
            console.error(`FAIL ${name}: ${error.message}`);
            try {
                await screenshot(`${name}-failure`);
            } catch {}
            failed++;
        }
    }

    async function login() {
        await driver.get(BASE_URL);

        await driver.wait(
            until.elementLocated(By.id("loginForm")),
            10000
        );

        const username = await driver.findElement(By.id("username"));
        const password = await driver.findElement(By.id("password"));

        await username.clear();
        await username.sendKeys("faculty");

        await password.clear();
        await password.sendKeys("faculty123");

        await driver.findElement(By.id("loginBtn")).click();

        await driver.wait(async () => {
            return await driver.findElement(By.id("appPanel")).isDisplayed();
        }, 15000);

        await driver.wait(async () => {
            return (await driver.findElement(By.id("status")).getText())
                .includes("Login successful");
        }, 15000);
    }

    async function tab(id) {
        await driver.findElement(
            By.css(`[data-tab="${id}"]`)
        ).click();

        await driver.wait(async () => {
            return await driver.findElement(By.id(id)).isDisplayed();
        }, 10000);
    }

    async function waitForStatus(text) {
        await driver.wait(async () => {
            return (await driver.findElement(By.id("status")).getText())
                .includes(text);
        }, 15000);
    }

    try {
        // TC01 - Faculty Login
        await testCase("TC01-Faculty-Login", async () => {
            await login();
        });

        // TC02 - Add Student
        await testCase("TC02-Add-Student", async () => {
            await tab("studentsSection");

            const suffix = Date.now();
            const rollNo = `AUTO${suffix}`;
            const studentName = "Selenium Test Student";
            const studentEmail = `auto${suffix}@example.com`;

            const result = await driver.executeScript(
                (roll, name, email) => {
                    const setValue = (id, value) => {
                        const input = document.getElementById(id);
                        const setter = Object.getOwnPropertyDescriptor(
                            HTMLInputElement.prototype,
                            "value"
                        ).set;

                        setter.call(input, value);
                        input.dispatchEvent(
                            new Event("input", { bubbles: true })
                        );
                        input.dispatchEvent(
                            new Event("change", { bubbles: true })
                        );
                    };

                    setValue("rollNo", roll);
                    setValue("studentName", name);
                    setValue("studentEmail", email);

                    return {
                        rollNo: document.getElementById("rollNo").value,
                        name: document.getElementById("studentName").value,
                        email: document.getElementById("studentEmail").value
                    };
                },
                rollNo,
                studentName,
                studentEmail
            );

            console.log("FORM DATA:", result);

            if (!result.rollNo || !result.name || !result.email) {
                throw new Error("Unable to populate student form");
            }

            await driver.findElement(By.id("addStudentBtn")).click();

            // Wait for registration and table refresh.
            await driver.wait(async () => {
                return driver.executeScript(
                    "return document.querySelector('#studentsBody').innerText.includes(arguments[0])",
                    rollNo
                );
            }, 20000, "Student was not added to the table");

            console.log("Student registration verified:", rollNo);
        });

        // TC03 - Mark Attendance
        await testCase("TC03-Mark-Attendance", async () => {
            await tab("attendanceSection");

            await driver.findElement(By.id("loadAttendanceBtn")).click();

            await driver.wait(async () => {
                return (await driver.findElements(
                    By.css("#attendanceBody select")
                )).length > 0;
            }, 15000, "No students available for attendance");

            await driver.findElement(By.id("saveAttendanceBtn")).click();
            await waitForStatus("Attendance");
        });

        // TC04 - Update Attendance
        await testCase("TC04-Update-Attendance", async () => {
            await tab("attendanceSection");

            await driver.findElement(By.id("loadAttendanceBtn")).click();

            await driver.wait(async () => {
                return (await driver.findElements(
                    By.css("#attendanceBody select")
                )).length > 0;
            }, 15000);

            const dropdown = await driver.findElement(
                By.css("#attendanceBody select")
            );

            await new Select(dropdown).selectByVisibleText("Absent");

            await driver.findElement(By.id("saveAttendanceBtn")).click();
            await waitForStatus("Attendance");
        });

        // TC05 - Attendance Percentage
        await testCase("TC05-Calculate-Attendance-Percentage", async () => {
            await tab("attendanceSection");

            await driver.findElement(By.id("refreshSummaryBtn")).click();

            await driver.wait(async () => {
                return (await driver.findElement(By.id("summaryBody")).getText())
                    .length > 0;
            }, 15000);
        });

        // TC06 - Internal Marks
        await testCase("TC06-Enter-Internal-Marks", async () => {
            await tab("marksSection");

            const subject = await driver.findElement(By.id("subject"));
            await subject.clear();
            await subject.sendKeys("Selenium Testing");

            const marks = {
                internal1: "24",
                internal2: "26",
                semester: "50",
                assignment: "8"
            };

            for (const [id, value] of Object.entries(marks)) {
                const field = await driver.findElement(By.id(id));
                await field.clear();
                await field.sendKeys(value);
            }

            await driver.findElement(By.id("saveMarksBtn")).click();
            await waitForStatus("Marks saved");
        });

        // TC07 - Performance Report
        await testCase("TC07-Generate-Performance-Report", async () => {
            await tab("reportsSection");

            await driver.findElement(By.id("generateReportBtn")).click();

            await driver.wait(async () => {
                return (await driver.findElement(By.id("reportOutput")).getText())
                    .includes("Attendance:");
            }, 15000);
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
