const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../server");
const http = require("node:http");

test("health endpoint responds successfully", async () => {
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, "student-attendance");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("faculty login accepts configured demo credentials", async () => {
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({username:"faculty",password:"faculty123"})
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
