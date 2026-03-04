/**
 * Restore fixed test item from baseline snapshot.
 * Requires:
 * - QOO10_WRITE_APPROVED=1
 * - QOO10_TEST_ITEMCODE
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { qoo10PostMethod } from "../src/qoo10Client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

const LOG_DIR = path.join(__dirname, "..", "logs");
const itemCode = String(process.env.QOO10_TEST_ITEMCODE || "").trim();

if (process.env.QOO10_WRITE_APPROVED !== "1") {
  console.error("[BLOCKED] Restore requires QOO10_WRITE_APPROVED=1");
  process.exit(2);
}
if (!itemCode) {
  console.error("[BLOCKED] Missing QOO10_TEST_ITEMCODE");
  process.exit(2);
}

const baselinePath = path.join(LOG_DIR, `qoo10-test-item-baseline-${itemCode}.json`);
if (!fs.existsSync(baselinePath)) {
  console.error(`[STOP] Baseline not found: ${baselinePath}`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));

function normalizePrice(v, fallback = 1000) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? String(n) : String(fallback);
}

async function readDetail(code) {
  const r = await qoo10PostMethod("ItemsLookup.GetItemDetailInfo", {
    returnType: "application/json",
    ItemCode: code,
  });
  if (r.data?.ResultCode !== 0) throw new Error(`Read failed: ${r.data?.ResultMsg}`);
  return r.data.ResultObject?.[0];
}

async function main() {
  const current = await readDetail(itemCode);
  const payload = {
    returnType: "application/json",
    ItemCode: itemCode,
    SecondSubCat: String(baseline.secondSubCat || current.SecondSubCatCd || ""),
    ItemTitle: String(baseline.title || current.ItemTitle || ""),
    ItemPrice: normalizePrice(current.SellPrice),
    ItemQty: String(baseline.qty || current.ItemQty || "1"),
    AvailableDateType: "0",
    AvailableDateValue: "2",
    ShippingNo: String(baseline.shippingNo || current.ShippingNo || "0"),
    StandardImage: String(baseline.imageUrl || current.ImageUrl || "https://dp.image-qoo10.jp/GMKT.IMG/loading_2017/qoo10_loading.v_20170420.png"),
    ItemDescription: String(baseline.description || current.ItemDetail || "<p>restore</p>"),
    TaxRate: "S",
    ExpireDate: String(baseline.expireDate || current.ExpireDate || "2030-12-31"),
    AdultYN: String(baseline.adultYN || current.AdultYN || "N"),
    RetailPrice: normalizePrice(baseline.retailPrice ?? current.RetailPrice ?? 0, 0),
    ProductionPlaceType: "2",
    ProductionPlace: "Overseas",
    Weight: "1",
  };

  const u = await qoo10PostMethod("ItemsBasic.UpdateGoods", payload);
  if (u.data?.ResultCode !== 0) {
    throw new Error(`Restore update failed: ${u.data?.ResultMsg}`);
  }

  const after = await readDetail(itemCode);
  const ok =
    String(after.ItemNo) === String(itemCode) &&
    String(after.ItemTitle || "") === String(payload.ItemTitle) &&
    String(after.ItemQty || "") === String(payload.ItemQty);

  if (!ok) {
    throw new Error("Restore verification mismatch (item/title/qty)");
  }

  console.log("[OK] restore complete");
  console.log(`[ITEM] ${itemCode}`);
  console.log(`[BASELINE] ${baselinePath}`);
}

main().catch((e) => {
  console.error(`[STOP] ${e.message}`);
  process.exit(1);
});
