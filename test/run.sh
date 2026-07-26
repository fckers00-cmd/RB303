#!/usr/bin/env bash
# รันเทสต์ทั้งชุด — ทำก่อน commit ทุกครั้ง
# ใช้: bash test/run.sh
set -u
cd "$(dirname "$0")/.."

TESTS="smoke ui_test test_dsp hash_test bank_test"

# ตรวจก่อนว่าไฟล์ครบ — ไฟล์เทสต์ที่หายไปเงียบๆ อันตรายกว่าเทสต์ที่ fail
missing=""
for t in $TESTS; do
  [ -f "test/$t.js" ] || missing="$missing test/$t.js"
done
if [ -n "$missing" ]; then
  echo "!!! ไม่มีไฟล์เทสต์:$missing"
  echo "    ต้องมีให้ครบก่อนถึงจะ commit ได้"
  exit 1
fi

fail=0
for t in $TESTS; do
  echo "=== $t ==="
  node "test/$t.js" || fail=1
  echo
done

if [ $fail -ne 0 ]; then
  echo "!!! มีเทสต์ที่ไม่ผ่าน"
  exit 1
fi
echo "=== ผ่านทั้งหมด ==="
