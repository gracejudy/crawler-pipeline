/**
 * Qoo10 공식 Read-Only 스모크 (ESM)
 * - ONLY: ItemsLookup.GetSellerDeliveryGroupInfo
 * - Gate(v1) 전용: 쓰기 API 절대 호출 금지
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { qoo10PostMethod } from "../src/qoo10Client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

function printResult(label, methodName, result) {
  const { status, data } = result;
  const code = data?.ResultCode;
  const msg = data?.ResultMsg ?? "(none)";

  console.log(`\n[${label}] ${methodName}`);
  console.log(`  status: ${status}`);
  console.log(`  ResultCode: ${code}`);
  console.log(`  ResultMsg: ${msg}`);

  const ok = code === 0;
  if (!ok) {
    console.log(`  --- response (full) ---`);
    console.log(JSON.stringify(data, null, 2));
    console.log(`  -----------------------`);
  }
  return ok;
}

async function main() {
  console.log("========== Qoo10 API Read-Only Smoke Test ==========");

  try {
    const methodName = "ItemsLookup.GetSellerDeliveryGroupInfo";
    const result = await qoo10PostMethod(methodName, { returnType: "application/json" });
    const ok = printResult("A", methodName, result);

    console.log("\n---------- Summary ----------");
    console.log(`  A) GetSellerDeliveryGroupInfo: ${ok ? "OK" : "FAIL"}`);
    console.log("--------------------------------\n");

    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error("\n[ERROR]", err.message);
    console.error("(env/키값은 출력하지 않음)\n");
    process.exit(1);
  }
}

main();
