#!/usr/bin/env bash
# รันเทสต์ทั้งชุด — ทำก่อน commit ทุกครั้ง
# ใช้: bash test/run.sh
set -u
cd "$(dirname "$0")/.."
fail=0
for t in smoke test_dsp hash_test; do
  echo "=== $t ==="
  node "test/$t.js" || fail=1
  echo
done
if [ $fail -ne 0 ]; then
  echo "!!! มีเทสต์ที่ไม่ผ่าน"
  exit 1
fi
echo "=== ผ่านทั้งหมด ==="
