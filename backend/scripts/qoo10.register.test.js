/**
 * Qoo10 API 로컬 테스트 스크립트 (ESM)
 * - A) ItemsLookup.GetSellerDeliveryGroupInfo (공식 문서 기반)
 * 민감정보(env 키값)는 콘솔에 출력하지 않음.
 *
 * 주의: ItemsBasic.SetNewGoods 기반 /api/qoo10/register 는
 * 공식 문서 비등재 API 정책에 따라 검증 대상에서 제외.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { qoo10PostMethod } from "../src/qoo10Client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// backend/.env 로드 (스크립트 위치 기준 상위 디렉터리)
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

async function runTestA() {
  const methodName = "ItemsLookup.GetSellerDeliveryGroupInfo";
  const result = await qoo10PostMethod(methodName, { returnType: "application/json" });
  return printResult("A", methodName, result);
}

async function main() {
  console.log("========== Qoo10 API Official Smoke Test ==========");

  try {
    const okA = await runTestA();

    console.log("\n---------- Summary ----------");
    console.log(`  A) GetSellerDeliveryGroupInfo: ${okA ? "OK" : "FAIL"}`);
    console.log("--------------------------------\n");

    process.exit(okA ? 0 : 1);
  } catch (err) {
    console.error("\n[ERROR]", err.message);
    console.error("(env/키값은 출력하지 않음)\n");
    process.exit(1);
  }
}

main();
