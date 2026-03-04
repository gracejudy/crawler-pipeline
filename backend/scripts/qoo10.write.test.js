/**
 * Qoo10 쓰기 테스트 (ESM)
 * - ONLY: ItemsBasic.SetNewGoods
 * - Gate에서 제외. 명시적 사용자 승인 시에만 실행.
 *
 * 실행 조건:
 *   QOO10_WRITE_APPROVED=1 npm run test:qoo10:write
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { qoo10PostMethod } from "../src/qoo10Client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

if (process.env.QOO10_WRITE_APPROVED !== "1") {
  console.error("[BLOCKED] Write test requires explicit approval: set QOO10_WRITE_APPROVED=1");
  process.exit(2);
}

// Optional category override. default uses requested category to reduce permission issues.
const WRITE_CATEGORY = process.env.QOO10_WRITE_CATEGORY || "300003183";

const REGISTER_PAYLOAD = {
  secondSubCat: WRITE_CATEGORY,
  itemTitle: "test item",
  itemPrice: 4000,
  itemQty: 99,
  availableDateType: "0",
  availableDateValue: "2",
  shippingNo: "0",
};

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

function buildSetNewGoodsParams(payload) {
  return {
    returnType: "application/json",
    SecondSubCat: String(payload.secondSubCat).trim(),
    ItemTitle: String(payload.itemTitle).trim(),
    ItemPrice: String(Number(payload.itemPrice)),
    ItemQty: String(Number(payload.itemQty)),
    AvailableDateType: String(payload.availableDateType).trim(),
    AvailableDateValue: String(payload.availableDateValue).trim(),
    ShippingNo: String(Number(payload.shippingNo ?? 0)),
    SellerCode: "A12345b",
    StandardImage: "https://dp.image-qoo10.jp/GMKT.IMG/loading_2017/qoo10_loading.v_20170420.png",
    ItemDescription: '<img src="https://dp.image-qoo10.jp/GMKT.IMG/loading_2017/qoo10_loading.v_20170420.png">',
    TaxRate: "10",
    ExpireDate: "2030-12-31",
    AdultYN: "N",
  };
}

async function main() {
  console.log("========== Qoo10 API WRITE Test (Approval Required) ==========");

  try {
    const methodName = "ItemsBasic.SetNewGoods";
    const params = buildSetNewGoodsParams(REGISTER_PAYLOAD);
    const result = await qoo10PostMethod(methodName, params);
    const ok = printResult("W", methodName, result);

    console.log("\n---------- Summary ----------");
    console.log(`  W) SetNewGoods: ${ok ? "OK" : "FAIL"}`);
    console.log("--------------------------------\n");

    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error("\n[ERROR]", err.message);
    console.error("(env/키값은 출력하지 않음)\n");
    process.exit(1);
  }
}

main();
