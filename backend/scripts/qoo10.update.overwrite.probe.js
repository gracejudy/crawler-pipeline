/**
 * Qoo10 overwrite-only deterministic probe (fixed test item only)
 *
 * v2a requirement:
 * - MUST use QOO10_TEST_ITEMCODE (no auto selection)
 * - BLOCKED (exit 2) if missing
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
fs.mkdirSync(LOG_DIR, { recursive: true });

const REQUIRED_ENV = ["QOO10_SAK", "QOO10_WRITE_APPROVED"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[STOP] Missing env: ${key}`);
    process.exit(1);
  }
}
if (process.env.QOO10_WRITE_APPROVED !== "1") {
  console.error("[BLOCKED] Write probe requires explicit approval: QOO10_WRITE_APPROVED=1");
  process.exit(2);
}

const TEST_ITEM = String(process.env.QOO10_TEST_ITEMCODE || "").trim();
if (!TEST_ITEM) {
  console.error("[BLOCKED] Missing QOO10_TEST_ITEMCODE. v2/v2a must use fixed test-only item.");
  process.exit(2);
}

const STATUSES = ["S0", "S1", "S2", "S3", "S5", "S8"];

async function getStatusTotals() {
  const totals = {};
  for (const s of STATUSES) {
    const r = await qoo10PostMethod("ItemsLookup.GetAllGoodsInfo", {
      returnType: "application/json",
      ItemStatus: s,
    });
    if (r.data?.ResultCode !== 0) {
      throw new Error(`GetAllGoodsInfo failed for ${s}: ${r.data?.ResultMsg}`);
    }
    totals[s] = Number(r.data?.ResultObject?.TotalItems || 0);
  }
  return totals;
}

async function readDetail(itemCode) {
  const r = await qoo10PostMethod("ItemsLookup.GetItemDetailInfo", {
    returnType: "application/json",
    ItemCode: itemCode,
  });
  if (r.data?.ResultCode !== 0) {
    throw new Error(`GetItemDetailInfo failed: ${r.data?.ResultMsg}`);
  }
  const d = r.data?.ResultObject?.[0];
  if (!d) throw new Error("GetItemDetailInfo returned empty ResultObject");
  return d;
}

function normalizePrice(v, fallback = 1000) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? String(n) : String(fallback);
}

function applyMarkerTitle(originalTitle, mark) {
  const max = 95;
  const suffix = ` ${mark}`;
  const keep = Math.max(1, max - suffix.length);
  return `${String(originalTitle).slice(0, keep)}${suffix}`;
}

function buildUpdatePayload(detail, itemCode, title) {
  return {
    returnType: "application/json",
    ItemCode: String(itemCode),
    SecondSubCat: String(detail.SecondSubCatCd || ""),
    ItemTitle: String(title),
    ItemPrice: normalizePrice(detail.SellPrice),
    ItemQty: String(detail.ItemQty || "1"),
    AvailableDateType: "0",
    AvailableDateValue: "2",
    ShippingNo: String(detail.ShippingNo || "0"),
    StandardImage: String(
      detail.ImageUrl ||
        "https://dp.image-qoo10.jp/GMKT.IMG/loading_2017/qoo10_loading.v_20170420.png"
    ),
    ItemDescription: String(detail.ItemDetail || "<p>update probe</p>"),
    TaxRate: "S",
    ExpireDate: String(detail.ExpireDate || "2030-12-31"),
    AdultYN: String(detail.AdultYN || "N"),
    RetailPrice: normalizePrice(detail.RetailPrice, 0),
    ProductionPlaceType: "2",
    ProductionPlace: "Overseas",
    Weight: "1",
  };
}

function baselinePath(itemCode) {
  return path.join(LOG_DIR, `qoo10-test-item-baseline-${itemCode}.json`);
}

function saveBaseline(itemCode, detail) {
  const baseline = {
    timestamp: new Date().toISOString(),
    itemCode,
    title: String(detail.ItemTitle || ""),
    description: String(detail.ItemDetail || ""),
    qty: String(detail.ItemQty || ""),
    secondSubCat: String(detail.SecondSubCatCd || ""),
    shippingNo: String(detail.ShippingNo || ""),
    imageUrl: String(detail.ImageUrl || ""),
    retailPrice: String(detail.RetailPrice || "0"),
    sellPrice: String(detail.SellPrice || "0"),
    expireDate: String(detail.ExpireDate || "2030-12-31"),
    adultYN: String(detail.AdultYN || "N"),
  };
  const p = baselinePath(itemCode);
  fs.writeFileSync(p, JSON.stringify(baseline, null, 2));
  return p;
}

async function updateOnce(itemCode, payload, expectedMarker, seq) {
  const u = await qoo10PostMethod("ItemsBasic.UpdateGoods", payload);
  if (u.data?.ResultCode !== 0) {
    throw new Error(`Update #${seq} failed: ${u.data?.ResultMsg}`);
  }

  const maxReadBackAttempts = 5;
  let lastTitle = "";
  let lastItemNo = "";

  for (let attempt = 1; attempt <= maxReadBackAttempts; attempt++) {
    const detail = await readDetail(itemCode);
    const title = String(detail.ItemTitle || "");
    const sameItem = String(detail.ItemNo || "") === String(itemCode);
    const matched = title.includes(expectedMarker);

    lastTitle = title;
    lastItemNo = String(detail.ItemNo || "");

    if (!sameItem) {
      throw new Error(`Read-back mismatch #${seq}: item changed (${detail.ItemNo} != ${itemCode})`);
    }
    if (matched) {
      return {
        seq,
        resultCode: u.data?.ResultCode,
        resultMsg: u.data?.ResultMsg,
        readBackItemNo: lastItemNo,
        readBackTitle: lastTitle,
        sameItem: true,
        matched: true,
        readBackAttempts: attempt,
      };
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error(`Read-back mismatch #${seq}: marker not found (${expectedMarker}), lastTitle=${lastTitle}`);
}

async function main() {
  const runBase = Date.now().toString().slice(-8);
  const itemCode = TEST_ITEM;

  const beforeTotals = await getStatusTotals(); // secondary evidence only
  const beforeDetail = await readDetail(itemCode);

  const baselineFile = saveBaseline(itemCode, beforeDetail);
  const originalTitle = String(beforeDetail.ItemTitle || "");

  const m1 = `[OVW-${runBase}-A]`;
  const m2 = `[OVW-${runBase}-B]`;

  const p1 = buildUpdatePayload(beforeDetail, itemCode, applyMarkerTitle(originalTitle, m1));
  const ev1 = await updateOnce(itemCode, p1, m1, 1);

  const d2 = await readDetail(itemCode);
  const p2 = buildUpdatePayload(d2, itemCode, applyMarkerTitle(originalTitle, m2));
  const ev2 = await updateOnce(itemCode, p2, m2, 2);

  const finalDetail = await readDetail(itemCode);
  const afterTotals = await getStatusTotals(); // secondary evidence only

  const evidence = {
    ok: true,
    timestamp: new Date().toISOString(),
    targetItemCode: itemCode,
    methodUpdate: "ItemsBasic.UpdateGoods",
    primaryProofMethod: "ItemsLookup.GetItemDetailInfo",
    secondaryMethod: "ItemsLookup.GetAllGoodsInfo",
    primaryProof: {
      before: {
        itemNo: String(beforeDetail.ItemNo || ""),
        title: String(beforeDetail.ItemTitle || ""),
      },
      run1: ev1,
      run2: ev2,
      after: {
        itemNo: String(finalDetail.ItemNo || ""),
        title: String(finalDetail.ItemTitle || ""),
      },
    },
    secondaryEvidence: {
      beforeTotals,
      afterTotals,
      totalsChanged: JSON.stringify(beforeTotals) !== JSON.stringify(afterTotals),
    },
    rollback: {
      baselineFile,
      restoreCommand: "cd backend && QOO10_WRITE_APPROVED=1 npm run test:qoo10:update:restore",
    },
  };

  const outPath = path.join(LOG_DIR, `qoo10-update-overwrite-proof-${runBase}.json`);
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));

  console.log("[OK] overwrite-only proof complete");
  console.log(`[EVIDENCE] ${outPath}`);
  console.log(`[BASELINE] ${baselineFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`[STOP] ${err.message}`);
  process.exit(1);
});
