# เช็กลิสต์การยกระดับความปลอดภัย

> เอกสารหลักสำหรับติดตามความคืบหน้าด้านความปลอดภัยของโครงการ `testingClash`
>
> ต้องอัปเดตเอกสารนี้หลังการพัฒนา ตรวจสอบ ทดสอบ rollback หรือทำงานผ่าน Codex ทุกครั้ง

## 1. สรุปโครงการ

| รายการ | ค่า |
|---|---|
| โครงการ | `testingClash` |
| แพลตฟอร์ม | Google Apps Script Web App |
| ผู้ที่ระบบใช้สิทธิ์ในการรัน | Me / เจ้าของสคริปต์ |
| ผู้ที่เข้าถึง Web App ได้ | Anyone |
| สถานะความเสี่ยง | ยืนยันเป็นระดับ Critical |
| Release ปัจจุบัน | R1 / Phase 1A — Containment |
| ไฟล์ระบบหลัก | `Code.js`, `index.html`, `userPopup.html`, `login.html` |

Web App รันโค้ดฝั่ง server ด้วยสิทธิ์ของเจ้าของสคริปต์ ดังนั้น public server function ทุกตัวต้องถือเป็น privileged entry point จนกว่าจะมีการยืนยันตัวตนและตรวจสิทธิ์ฝั่ง server อย่างชัดเจน

## 2. ผลตรวจ Deployment และความปลอดภัย

ข้อมูล Deployment ที่ยืนยันแล้ว:

- Execute as: Me / script owner
- Access: Anyone

ผลตรวจด้านความปลอดภัย:

- ห้ามเชื่อ identity ที่ browser ส่งมา ได้แก่:
  - `currentUsername`
  - `role`
  - `submittedBy`
  - `cancelledBy`
- `loginCheck` ตรวจ username/password แต่ยังไม่ออก server-issued session token
- Frontend เก็บข้อมูลผู้ใช้และ role ไว้ใน `window.currentUser`
- ยังไม่มี session lifecycle, expiration, revocation หรือ logout ฝั่ง server
- Role guard ปัจจุบันค้นสิทธิ์จาก username ที่ browser เป็นผู้ส่ง
- Public RPC มีทั้ง mutation, admin, monthly close, snapshot, export, Telegram, setup, test, repair และ migration
- Export บางตัวสร้างไฟล์ Drive ที่แชร์แบบ `ANYONE_WITH_LINK`

ข้อสรุป:

> ห้ามใช้ username หรือ role จาก client เพื่อตัดสินสิทธิ์ ต้องใช้ session ที่ server ออกให้ การค้นข้อมูลผู้ใช้ฝั่ง server และ authorization helper กลางเท่านั้น

## 3. กฎหลัก

- [ ] ใช้หลัก default deny: เปิดเฉพาะ public endpoint ที่อนุมัติแล้ว
- [ ] ห้ามเชื่อ `currentUsername`, `role`, `submittedBy`, `cancelledBy` หรือ actor field จาก browser
- [ ] Actor ต้องมาจาก server session ที่ผ่านการตรวจสอบ
- [ ] ตรวจ role, account status และ permission ล่าสุดจาก server ทุกครั้ง
- [ ] Public RPC ต้องทำงานตามลำดับ: authenticate → authorize → validate → execute → audit
- [ ] Internal helper ต้องลงท้ายชื่อด้วย `_`
- [ ] Setup, test, repair, migration, trigger และ maintenance function ต้องไม่เปิดเป็น public RPC
- [ ] `doGet` ต้อง render เท่านั้น ห้ามแก้ schema หรือข้อมูล
- [ ] ปิด self-registration เป็นค่าเริ่มต้น
- [ ] ห้ามสร้างไฟล์ Drive แบบ `ANYONE_WITH_LINK` ก่อนบังคับใช้ authentication และ authorization
- [ ] Telegram function ต้องไม่เป็น public RPC
- [ ] ข้อมูล actor ใน audit log ต้องมาจาก validated server session
- [ ] ห้ามเก็บ plaintext password, raw session token, secret หรือ private deployment URL ในเอกสารนี้
- [ ] ห้ามลดระดับ R1 containment ระหว่างที่ phase ถัดไปยังไม่เสร็จ
- [ ] Safe rollback ต้องย้อนกลับไป R1 containment ไม่ใช่โค้ดก่อน R1

## 4. แผน Release

| Release | Phase | เป้าหมาย | ลำดับ Deploy | สถานะ | จุด Rollback ที่ปลอดภัย |
|---|---|---|---:|---|---|
| R1 | Phase 1A — Containment | ปิดพฤติกรรม public/anonymous ที่อันตราย | 1 | เสร็จสมบูรณ์ — deploy และผ่าน Production Smoke Test แล้ว | คง R1 containment |
| R2 | Phase 1B — Session foundation | เพิ่ม server session และ auth helper กลาง | 2 | กำลังดำเนินการ — R2A/R2B/R2C commit แล้ว; รอ R2D test gate | R1 |
| R3 | Phase 1C — Server protection | ป้องกัน endpoint สำคัญด้วย permission และ resource scope | 3 | ยังไม่เริ่ม | R1 หรือ R2 รุ่นล่าสุดที่ผ่านการตรวจ |
| R4 | Phase 1D — Frontend token migration | เปลี่ยน frontend ให้ใช้ token และเลิกส่ง identity claim | 4 | ยังไม่เริ่ม | R1 โดยปิด protected features ไว้ |
| R5 | Phase 1E — Test gate | ทดสอบ regression และ security ให้ครบ | 5 | ยังไม่เริ่ม | Protected release ล่าสุดที่ผ่านการตรวจ |

**Release แรกที่ deploy แล้ว:** R1 / Phase 1A — Containment

R1 อาจทำให้ write, admin และ export ใช้งานไม่ได้ชั่วคราว ซึ่งเป็นผลที่ยอมรับได้เพื่อหยุด Critical vulnerability

## 5. งานที่กำลังดำเนินการ

| รายการ | สถานะปัจจุบัน |
|---|---|
| Active release | R2 |
| Active phase | R2C เสร็จ; งานถัดไป R2D — Foundation security test gate |
| เป้าหมาย | เพิ่ม permission map แบบ default-deny และ actor ที่มาจาก validated server session |
| สถานะ implementation | R2A/R2B/R2C เสร็จแล้วใน `Code.js`; ยังไม่ผูก permission helper เข้ากับ protected endpoints |
| สถานะ review | Permission matrix, role refresh, forged token และ default-deny tests ผ่าน |
| สถานะ commit | `5a0fe1b1a91c1e8d55f60134eafcafca353be118` — `security: add default deny permission map` |
| สถานะ Apps Script source | Production ยังเป็น R1; R2 ยังไม่ได้ `clasp push` |
| สถานะ verification | session/login/throttling/permission foundation tests ผ่าน |
| สถานะ Manual Test Gate | ยังไม่เริ่มสำหรับ R2 |
| สถานะ deployment | R1 อยู่บน production; R2 ยังไม่ได้ deploy |
| Blocker | Task ownership และ Export permission ยัง block การมอบ permission ใน R3; password hashing migration ยังต้องวางแผนแยก |
| งานถัดไป | ทำ R2D regression/security test gate; ยังไม่ `clasp push`/deploy |

## 6. เช็กลิสต์ R1 / Phase 1A — Containment

### ควบคุมขอบเขต

- [x] จำกัด R1 เฉพาะ containment ไม่ทำ session system ทั้งชุด
- [x] บันทึก public RPC inventory ก่อนเปลี่ยน visibility
- [x] ตรวจ installed/time-driven triggers แล้ว — ไม่พบ installed trigger
- [x] ไม่มี trigger ที่ต้องรักษาผ่าน private wrapper ใน R1
- [x] ใช้ maintenance response contract เดียวกันทุก endpoint ที่ปิดชั่วคราว
- [x] ทุก endpoint ต้องหยุดก่อนเกิด read/write side effect
- [x] ไม่แก้ `.clasp.json` ใน main repo
- [x] ไม่แก้ `appsscript.json`
- [x] Commit และ controlled `clasp push` ทำหลังได้รับอนุมัติชัดเจน
- [x] Deploy หลังได้รับอนุมัติและผ่าน Production Smoke Test

### ผลลัพธ์ที่ต้องได้

- [x] Anonymous visitor เปิดหน้า Web App ได้
- [x] Anonymous caller แก้ task, user, period, snapshot หรือ configuration ไม่ได้
- [x] Anonymous caller อ่านข้อมูล admin/monthly close ที่มีสิทธิ์สูงไม่ได้
- [x] Anonymous caller สร้าง public Drive export ไม่ได้
- [x] Anonymous caller เรียก Telegram ไม่ได้
- [x] Anonymous caller เรียก setup, test, repair, cleanup, QA หรือ migration ไม่ได้
- [x] Identity จาก browser ไม่มีผลต่อสิทธิ์ใน endpoint ที่ R1 contain

## 7. เช็กลิสต์ `doGet` แบบ Render-only

ไฟล์เป้าหมาย: `Code.js`

Function เป้าหมาย:

- `doGet`

นำรายการต่อไปนี้ออกจาก web-request path:

- `setupSheet`
- `setupHistorySheet`
- `ensureInputStatusColumns`
- Schema creation, header repair, migration หรือ write operation อื่นทั้งหมด

เช็กลิสต์:

- [x] `doGet` ทำเพียงสร้าง/evaluate HTML template และกำหนด presentation metadata
- [ ] การเปิดหรือ refresh Web App ไม่สร้าง sheet
- [ ] การเปิดหรือ refresh Web App ไม่เพิ่มหรือแก้ column
- [ ] การเปิดหรือ refresh Web App ไม่เขียน timestamp หรือ configuration
- [x] Setup functions ถูกเปลี่ยนเป็น private/internal
- [x] `doGet` ไม่ซ่อม schema ผ่าน anonymous request
- [ ] Manual test ต้องเปรียบเทียบสถานะ spreadsheet ก่อนและหลัง page load

ความเสี่ยงเมื่อ rollback:

- ความเสี่ยงด้านโค้ดต่ำ
- อาจกระทบ availability หาก production schema ยังไม่ครบ
- ห้าม rollback กลับไปใช้ anonymous schema mutation

## 8. ปิด `registerUser` เป็นค่าเริ่มต้น

ไฟล์เป้าหมาย: `Code.js`

Function เป้าหมาย:

- `registerUser`

เช็กลิสต์:

- [x] เพิ่ม self-registration policy ที่ควบคุมจาก server
- [x] หากไม่มีค่า config หรือค่าไม่ถูกต้อง ให้ถือว่าปิด
- [x] คืน `SECURITY_MAINTENANCE` ก่อนเพิ่มแถวเมื่อ registration ปิด
- [x] ไม่รับ registration policy จาก browser
- [x] ไม่เปิด self-registration ขณะที่ยังเก็บ password แบบ plaintext
- [x] ไม่ตรวจหรือเปิดเผยข้อมูล username เมื่อ registration ถูกปิด
- [x] ย้าย rate limiting และ password migration ไป R2
- [ ] ยืนยันว่าจำนวนแถวในชีต `login` ไม่เปลี่ยนเมื่อ registration ถูกปิด

ประเด็นที่ต้องตัดสินใจก่อนเปิด:

- ใครสมัครเองได้
- ตรวจ identity อย่างไร
- ต้องได้รับอนุมัติก่อนเปิดใช้งานหรือไม่
- Default role และ department scope คืออะไร
- ต้องใช้ abuse/rate control แบบใด

ความเสี่ยงเมื่อ rollback:

- ความเสี่ยงด้าน security ต่ำหากยังปิดอยู่
- อาจกระทบผู้ใช้หากองค์กรพึ่งพาการสมัครแบบเปิด
- ห้าม rollback ด้วยการเปิด anonymous plaintext registration

## 9. ปิด Mutation, Admin และ Export Endpoint ชั่วคราว

ทุก endpoint ด้านล่างต้องคืน structured maintenance response ก่อนเกิด side effect ใด ๆ

### Task mutation

- [x] `addTask`
- [x] `deleteTask`
- [x] `updateTaskDetails`
- [x] `updateTaskStatus`
- [x] `updateTaskProgress`
- [x] `updateTaskProgressOutcome`
- [x] `updateTaskProgressAndStatus`
- [x] `cancelTaskMonthlySubmission`

### User และ Admin

- [x] `getAllUsers`
- [x] `updateUserRole`
- [x] `deleteUser`
- [ ] ยืนยันว่า frontend `updateUser` ที่ยังหา server implementation ไม่พบ เรียกโค้ดที่ไม่ได้ review ไม่ได้

### Monthly close, period control และ snapshot

- [x] `getMonthlyCloseManagementConsoleData`
- [x] `runDryRunSnapshotForMonthlyCloseConsole`
- [x] `getDataQualityBeforeClosePeriodForUI`
- [x] `closeMonthlyPeriod`
- [x] `runClosePeriodFromMonthlyCloseConsole`
- [x] `resetMonthlyTaskProgress`
- [x] `resetPeriodControlToCurrentMonth`
- [x] `openPreviousMonthInputPeriod`
- [x] `getBulkReportingScheduleSetupData`
- [x] `updateBulkReportingSchedules`
- [x] `saveSnapshotConfig`
- [x] `snapshotNow`
- [x] `getSystemConfig`
- [x] `getSnapshotConfig`
- [x] `getClosePeriodDataQualityPreview`
- [x] `previewSnapshotQualityBeforeClosePeriod`

### Export

- [x] `exportTasksToCSV`
- [x] `createHTMLDownloadUrl`
- [x] `createCSVDownloadUrl`
- [x] `exportMonthlyClosedReportCsv`
- [x] `exportMonthlyClosedRawDataCsv`
- [x] Endpoint ถูกปิดก่อนสร้างไฟล์ Drive
- [x] Static verification ไม่พบ `DriveApp.Access.ANYONE_WITH_LINK`
- [ ] ปิด Drive URL export ต่อไปจนกว่า R3 authorization จะเสร็จ
- [ ] ใน R4 ให้ใช้ authenticated response content และ browser-local `Blob`

### การจัดการ Identity

- [x] Contained endpoints ไม่ใช้ `currentUsername` เพื่อ authorize ก่อนคืน maintenance response
- [x] Contained endpoints ไม่ใช้ `role` จาก browser เพื่อ authorize
- [x] Contained endpoints ไม่ใช้ `submittedBy`
- [x] Contained endpoints ไม่ใช้ `cancelledBy`
- [x] Contained endpoints ไม่เขียน actor จาก browser ลง audit log

ความเสี่ยงเมื่อ rollback:

- กระทบ availability สูง เพราะ write/admin/export จะใช้งานไม่ได้
- ความเสี่ยงต่อ data integrity ต่ำ เพราะ endpoint ต้องไม่มี side effect
- การ rollback ไปก่อน R1 จะทำให้ Critical vulnerability กลับมา

## 10. ทำ Telegram และ Internal Functions ให้เป็น Private

ไฟล์เป้าหมาย: `Code.js`

### Telegram และ Integration

- [x] เปลี่ยน `sendMessage` เป็น `sendMessage_` และแก้ internal references
- [x] เปลี่ยน `sendLongMessage` เป็น `sendLongMessage_`
- [x] เปลี่ยน `notifyGroup` เป็น `notifyGroup_`
- [x] เปลี่ยน `notifySnapshotFromSheet` เป็น `notifySnapshotFromSheet_`
- [x] เปลี่ยน `createSnapshotFileInDrive` เป็น `createSnapshotFileInDrive_`
- [x] เปลี่ยน `testNotify` เป็น `testNotify_`
- [x] Bot token ยังอ่านจาก server properties
- [x] Browser RPC เรียก `sendMessage` เพื่อกำหนด Telegram `chatId` ไม่ได้
- [ ] ให้ `doPost` ไม่มี side effect จนกว่าจะออกแบบ webhook authentication

### Setup และ Internal Maintenance

- [x] ทำ setup functions ให้เป็น private/internal:
  - `setupSheet`
  - `setupHistorySheet`
  - `setupPeriodControlSheet`
  - `setupSubDepConfigSheet`
  - `setupPeriodActionLogSheet`
  - `ensureInputStatusColumns`
- [x] ทำ maintenance/trigger functions ให้เป็น private/internal:
  - `manualTriggerWithConfig`
  - `recalculateAllAchievements`
  - `clearMonthlyInputForActivePeriod`
- [ ] ตรวจ installed triggers ก่อนเปลี่ยนชื่อ handler
- [ ] ระบุเหตุผลของ function ที่จำเป็นต้องคงเป็น trigger entry point

### Test, QA, Repair และ Migration

- [x] ทำ function ที่ขึ้นต้นด้วย `test` ทุกตัวให้เป็น private/internal
- [x] ทำ function ที่ขึ้นต้นด้วย `step` ทุกตัวให้เป็น private/internal
- [x] ทำ repair functions ให้เป็น private/internal:
  - `repairActivePeriodKey`
  - `repairPeriodKeysToTextOnce`
  - `repairLevelTargetFieldsForDQ`
  - `repairBlankReportingFieldsInHistory202611`
- [x] ทำ QA cleanup functions ให้เป็น private/internal:
  - `findQaPartialSnapshotRowsForActivePeriod`
  - `deleteQaPartialSnapshotRowsForActivePeriod`
  - `findTestSnapshotRowsForActivePeriod`
  - `deleteTestSnapshotRowsForActivePeriod`
- [x] ทำ verification/preview maintenance functions ให้เป็น private/internal:
  - `verifyClosedPeriodSnapshotCompleteness_202611`
  - `previewBlankReportingFieldsInHistory202611`
- [x] ทำ `migrateTaskDataMasterToDevSchema` ให้เป็น private/internal
- [x] สำรวจ public functions ใหม่อีกครั้งหลัง rename
- [x] Static review ไม่พบ frontend อ้างถึง function ที่เปลี่ยนเป็น private

ความเสี่ยงเมื่อ rollback:

- เสี่ยงระดับกลางต่อ installed trigger ที่อ้างชื่อเดิม
- เสี่ยงระดับกลางต่อ internal call site ที่แก้ไม่ครบ
- กระทบผู้ใช้ต่ำสำหรับ function ที่ไม่ควรเป็น frontend API อยู่แล้ว

## 11. Response Contract: `SECURITY_MAINTENANCE`

Endpoint ที่ปิดชั่วคราวควรคืน response รูปแบบเดียวกัน:

```json
{
  "success": false,
  "ok": false,
  "code": "SECURITY_MAINTENANCE",
  "message": "This operation is temporarily unavailable while security controls are being upgraded.",
  "retryable": false,
  "release": "R1"
}
```

กติกา:

- [x] ใช้ machine-readable code `SECURITY_MAINTENANCE`
- [x] Response ไม่มี stack trace, sheet name, file ID, deployment URL, username, role, token หรือ secret
- [x] คืน response ก่อน mutation, Drive creation, Telegram request หรือ privileged read
- [x] ใช้ response shape กลางจาก `securityMaintenanceResponse_`
- [x] Frontend แสดงข้อความ maintenance ทั่วไปโดยไม่ใช้ response เพื่อตัดสิน authorization
- [ ] บันทึกชื่อ endpoint ใน server log ได้เมื่อ log ไม่มี sensitive payload
- [x] รักษา response contract เดิมด้วย JSON string/plain text compatibility helper ตามประเภท RPC

## 12. Manual Test Gate สำหรับ R1

ห้าม deploy R1 จนกว่าการทดสอบที่เกี่ยวข้องจะผ่าน

### Render-only

- [ ] บันทึกรายชื่อ sheet, จำนวน header และ timestamp ที่เกี่ยวข้องก่อนทดสอบ
- [x] เปิด Web App และทดสอบ application shell ผ่าน test deployment
- [x] Refresh และเข้าใช้งานหลายหน้าระหว่างการทดสอบ
- [x] ยืนยันว่า schema และข้อมูลที่ตรวจไม่เปลี่ยน
- [x] ยืนยันว่า application shell render ได้

### Registration

- [x] ทดลองสมัครเมื่อ self-registration ปิดเป็นค่าเริ่มต้น
- [ ] ทดลองสมัครเมื่อ policy config ไม่ถูกต้อง
- [x] ยืนยันว่าคำขอสมัครที่ทดสอบถูกปฏิเสธด้วย maintenance response
- [x] ยืนยันว่าไม่มีแถวเพิ่มในชีต `login`

### Mutation, Admin และ Monthly Close

- [ ] เรียก task mutation ทุกตัวโดยไม่ login
- [ ] เรียก endpoint โดยปลอม username ของ superadmin
- [x] ทดสอบ monthly-close readiness และ snapshot/config ผ่าน UI
- [x] Endpoint ที่ทดสอบคืน `SECURITY_MAINTENANCE`; endpoint อื่นตรวจยืนยันด้วย static review
- [x] ยืนยันว่า Task และ SystemConfig ไม่เปลี่ยน และไม่พบ side effect ต่อข้อมูลที่ตรวจ

### Export และ Drive

- [ ] เรียก export endpoint ทุกตัวโดยตรง
- [x] ยืนยันว่าไม่มีไฟล์ export/snapshot ใหม่ถูกสร้างใน Drive
- [x] ยืนยันจาก Drive และ static verification ว่าไม่มีไฟล์ใหม่กลายเป็น `ANYONE_WITH_LINK`
- [x] ยืนยันว่า export ที่ทดสอบไม่ส่ง download URL กลับ

### Telegram และ Internal RPC

- [ ] ทดลอง `google.script.run.sendMessage(...)` และยืนยันว่าเรียกไม่ได้
- [ ] ทดลองเรียก setup, test, repair, QA cleanup และ migration RPC ตัวอย่าง
- [x] ยืนยันด้วย static review ว่า Telegram/setup/test/repair/QA/migration functions ถูกทำเป็น private/internal
- [x] ไม่พบ Telegram request ระหว่างการทดสอบ R1
- [x] ไม่พบ schema repair หรือ migration ระหว่างการทดสอบ R1

### Trigger Safety

- [x] ตรวจหน้า Triggers แล้วพบ installed triggers จำนวน 0
- [x] ไม่มี trigger ที่อนุมัติซึ่งต้องตรวจหลัง rename
- [x] ตรวจ Executions แล้วไม่พบ trigger failure ที่เกิดจาก R1

### Source Review

- [x] สำรวจ public functions ใหม่ทั้งหมด
- [x] ตรวจ public function ที่เหลือทุกตัวเทียบกับ allowlist
- [x] ค้นหา `ANYONE_WITH_LINK` และไม่พบใน R1 source
- [x] ตรวจการใช้ browser actor fields และ contain endpoint ที่ยังไม่มี server-trusted identity
- [x] ตรวจ `git diff` และยืนยันว่า commit แต่ละชุดแก้เฉพาะไฟล์ที่อนุมัติ
- [x] ได้รับอนุมัติก่อน commit และ controlled `clasp push`; ยังไม่ได้ deploy

ผล Review R1:

- [x] ผ่าน — manual representative tests ร่วมกับ static verification
- [ ] ไม่ผ่าน

หมายเหตุ: R1 Gate ยืนยันเป้าหมาย containment และ absence of side effects จากกรณีที่ทดสอบแล้ว แต่ยังไม่ใช่ automated endpoint-by-endpoint security suite; การทดสอบแบบ exhaustive อยู่ใน R5
- [ ] ผ่านแบบมีเงื่อนไข
- ผู้ตรวจ:
- วันที่:
- หลักฐาน/เอกสารอ้างอิง:

## 13. การตัดสินใจที่ยัง Blocked

| เรื่อง | คำตอบที่ต้องการ | ผู้รับผิดชอบ | สถานะ | Block งาน |
|---|---|---|---|---|
| Self-registration policy | ปิดถาวร, invite-only, ต้องอนุมัติ หรือเปิดทั่วไป | TBD | Blocked | การเปิด `registerUser` |
| Task ownership model | ใช้ immutable user ID, department, work group, approver หรือผสมกัน | TBD | Blocked | R3 task authorization |
| Export permission | Role/scope ใด export summary, detailed และ raw data ได้ | TBD | Blocked | R3/R4 export |
| Session storage | ใช้ Script Properties สำหรับ rollout แรก; เก็บเฉพาะ token hash, TTL 8 ชั่วโมง, idle 30 นาที และไม่ใช้ CacheService เป็น source of truth | เจ้าของโครงการ | ตัดสินใจแล้ว 2026-06-19 | ทบทวนใหม่เมื่อจำนวน concurrent sessions หรือ quota เพิ่มสูง |

เช็กลิสต์การบันทึกการตัดสินใจ:

- [x] บันทึกตัวเลือกและเหตุผลสำหรับ session storage
- [x] บันทึกผู้อนุมัติและวันที่สำหรับ session storage
- [x] บันทึกว่า R2A ยังไม่เปิด permission/endpoint ใด
- [x] Rollback ของ R2A คือ R1 containment

## 14. Placeholder สำหรับ Release ถัดไป

### R2 / Phase 1B — Session Foundation

สถานะ: กำลังดำเนินการ — R2A/R2B/R2C เสร็จและ commit แล้ว; R2D–R2E ยังไม่เริ่ม

- [x] เพิ่ม private helper สำหรับออก opaque session token จาก server
- [x] เก็บเฉพาะ SHA-256 token hash ฝั่ง server
- [x] มี absolute expiry, idle timeout, revocation และ cleanup
- [x] เพิ่ม `logoutSession` endpoint แบบ idempotent
- [x] เพิ่ม `getSessionContext` endpoint
- [x] ผูก session กับ immutable user ID
- [x] เพิ่ม `requireSession_`
- [x] เพิ่ม permission map แบบ default-deny และ `requirePermission_`
- [x] เพิ่ม login throttling: 5 ครั้งใน 15 นาที และ lockout 15 นาที
- [ ] วางแผน password hashing และ plaintext migration
- [x] ยังไม่เปิด critical endpoint ใน foundation-only implementation

ไฟล์ที่คาดว่าจะแก้:

- `Code.js`

Rollback target: R1 containment

### R3 / Phase 1C — Server Protection

สถานะ: ยังไม่เริ่ม

- [ ] ป้องกัน critical endpoints ด้วย session validation
- [ ] เพิ่ม server-side permission map
- [ ] บังคับ task ownership และ organizational scope
- [ ] ดึง audit actor จาก validated session
- [ ] ใช้ thin public wrapper ครอบ private business logic
- [ ] เปิดกลับเฉพาะ endpoint ที่ review แล้ว
- [ ] ยังไม่เปิด public Drive-link export

ไฟล์ที่คาดว่าจะแก้:

- `Code.js`

Rollback target: R1 หรือ R2 รุ่นล่าสุดที่ผ่านการตรวจ

### R4 / Phase 1D — Frontend Token Migration

สถานะ: ยังไม่เริ่ม

- [ ] เก็บ session token ใน memory สำหรับ rollout แรก
- [ ] ส่ง token ไปทุก protected RPC
- [ ] ลบ browser identity claim จาก protected payload
- [ ] ใช้ข้อมูล user จาก server เพื่อแสดงผลเท่านั้น
- [ ] Revoke token เมื่อ logout
- [ ] จัดการ token expiry และ authorization error ให้เป็นมาตรฐาน
- [ ] เปลี่ยน public Drive export เป็น authenticated content/local `Blob`

ไฟล์ที่คาดว่าจะแก้:

- `index.html`
- `userPopup.html`
- `login.html`

Rollback target: R1 โดย protected features อาจยังใช้งานไม่ได้

### R5 / Phase 1E — Regression และ Security Test Gate

สถานะ: ยังไม่เริ่ม

- [ ] ทดสอบ session lifecycle
- [ ] ทดสอบ forged identity
- [ ] ทดสอบ expired/revoked token
- [ ] ทดสอบ role change และ disabled account
- [ ] ทดสอบ task IDOR และ scope
- [ ] ทดสอบ monthly-close และ snapshot permissions
- [ ] ทดสอบ export authorization
- [ ] ทดสอบ public RPC inventory
- [ ] ทดสอบ concurrent close/snapshot
- [ ] ตรวจ anonymous allowlist รอบสุดท้าย

ไฟล์ที่คาดว่าจะแก้:

- เสนอไฟล์ private test ชื่อ `SecurityTests.js`
- แก้ไฟล์เดิมเฉพาะกรณีที่จำเป็นต่อ testability และผ่านการอนุมัติแยก

Rollback target: Protected release ล่าสุดที่ผ่านการตรวจ

## 15. Template สำหรับ Work Log

### 2026-06-18 — สร้างเอกสารติดตาม Security Rollout

- ไฟล์ที่สร้าง: `SECURITY_ROLLOUT_CHECKLIST.md`
- วัตถุประสงค์: ใช้ติดตามความคืบหน้าของ security rollout
- Current active release: R1 / Phase 1A — Containment
- การแก้ application code: ไม่มี
- Commit: ไม่ได้ดำเนินการ
- Push: ไม่ได้ดำเนินการ
- Deployment: ไม่ได้ดำเนินการ
- `clasp push`: ไม่ได้ดำเนินการ

### 2026-06-18 — Commit R1 / Phase 1A Containment

- Current active release: R1 / Phase 1A — Containment
- Commit: `15671078ca9a7048a44458ee05254cd89f275469`
- Commit message: `security: contain unsafe public rpc surface`
- ไฟล์ที่เปลี่ยนใน commit: `Code.js`
- Manual test gate: รอดำเนินการ
- Push: ไม่ได้ดำเนินการ
- `clasp push`: ไม่ได้ดำเนินการ
- Deployment: ไม่ได้ดำเนินการ
- Working tree อื่นที่ไม่เกี่ยวข้องยังคงอยู่:
  - `index.html` modified
  - `data/` untracked

### 2026-06-18 — R1 Backup, Verification และ Controlled Push

- Backup folder: `C:\Users\User\testingClash_backup_before_r1`
- Backup action: `clasp pull` สำเร็จ 7 Apps Script files
- Push sandbox: `C:\Users\User\testingClash_push_r1`
- Verification Gate:
  - Non-Code files ใน sandbox ตรงกับ backup ทั้งหมด
  - `Code.js` ใน sandbox ตรงกับ main repo และ R1 commit
  - R1 commit อยู่ใน main branch history
  - ไม่พบ hard-coded `SELF_REGISTRATION_ENABLED = true`
  - ไม่พบ `ANYONE_WITH_LINK`
  - `clasp status` ใน sandbox มีเฉพาะ Apps Script files 7 ไฟล์
- Controlled `clasp push`: สำเร็จจาก sandbox 7 ไฟล์
- `--force`: ไม่ได้ใช้
- Git commit/push เพิ่มเติม: ไม่ได้ดำเนินการ
- Deployment: ไม่ได้ดำเนินการ
- Manual Test Gate: รอดำเนินการ
- Trigger Safety Check: รอดำเนินการ
- Main repo หลัง push: มีเฉพาะ `.claspignore` ที่ modified ในขณะตรวจ

### 2026-06-18 — R1 Manual Test Gate ผ่าน

- ขอบเขต: R1 / Phase 1A — Containment
- วิธีตรวจ: manual representative tests ผ่าน test deployment ร่วมกับ static verification
- Application shell และ login render ได้
- Self-registration ถูกปฏิเสธ และไม่มีแถวใหม่ในชีต `login`
- User management, task mutation, monthly-close readiness, snapshot/config และ export ถูกปฏิเสธด้วย maintenance response
- ยืนยันว่า Task และ SystemConfig ไม่เปลี่ยน
- ยืนยันว่าไม่มีไฟล์ export/snapshot ใหม่ใน Google Drive
- ยืนยันว่า export ไม่คืน download URL
- ตรวจหน้า Triggers แล้วพบ installed triggers จำนวน 0
- ตรวจ Executions แล้วไม่พบ trigger failure ที่เกิดจาก R1
- ผล: R1 Manual Test Gate ผ่าน
- ข้อจำกัด: ยังไม่มี automated endpoint-by-endpoint security suite; ย้ายการทดสอบ exhaustive ไป R5
- Git commit/push: ไม่ได้ดำเนินการในรอบบันทึกผลนี้
- `clasp push`: ไม่ได้ดำเนินการในรอบบันทึกผลนี้
- Deployment: ยังไม่ได้ดำเนินการ
- การอนุมัติ deploy: เจ้าของโครงการอนุมัติแล้ว
- งานถัดไป: Deploy R1 ผ่าน Apps Script UI และทำ production smoke test

### 2026-06-19 — R1 Production Deploy และ Smoke Test ผ่าน

- ขอบเขต: R1 / Phase 1A — Containment
- Compatibility hotfix commit: `c247358b6cf82f32dfaf4fba496e4c119377c845`
- Commit message: `fix: handle object response in user management`
- ไฟล์ใน hotfix commit: `userPopup.html`
- Controlled `clasp push`: สำเร็จจาก `C:\Users\User\testingClash_push_r1`
- `--force`: ไม่ได้ใช้
- Post-push verification: pull ตรวจซ้ำแล้ว remote HEAD ตรงกับ sandbox ครบ 7 ไฟล์
- Deployment: Deploy production เป็นเวอร์ชันใหม่ผ่าน Apps Script UI แล้ว
- Production Smoke Test:
  - User Management แสดง `SECURITY_MAINTENANCE` โดย loader ไม่ค้าง
  - Console ไม่พบ JSON parse error และไม่พบ JavaScript error ใหม่
  - Registration ถูกบล็อก
  - Export ถูกบล็อกและไม่คืน download URL
  - Task mutation ถูกบล็อก
  - Monthly Close readiness ถูกบล็อก
  - Task และ SystemConfig ไม่เปลี่ยน
  - ไม่มีไฟล์ export/snapshot ใหม่ใน Google Drive
- ผล: Production Smoke Test ผ่าน และ R1 เสร็จสมบูรณ์
- ความเสี่ยงคงเหลือ: ข้อความ maintenance/ข้อผิดพลาดบางจุดยังไม่สม่ำเสมอ เป็น UX improvement และไม่บล็อก R1
- Git push: ไม่ได้ดำเนินการ
- งานถัดไป: ออกแบบ R2 server-issued session โดยยังคง R1 containment ไว้

### 2026-06-19 — R2A Session Primitives

- ขอบเขต: R2A foundation เฉพาะ private server helpers
- Commit: `5db29a656b612d7759ee37d18af6dd932e1dd93d`
- Commit message: `security: add server session primitives`
- ไฟล์ที่แก้: `Code.js`
- Session storage: Script Properties สำหรับ rollout แรก
- Token:
  - opaque token ความยาว 64 ตัวอักษร
  - เก็บเฉพาะ SHA-256 hash ฝั่ง server
  - ไม่เก็บ raw token ใน Script Properties
- Session policy:
  - absolute TTL 8 ชั่วโมง
  - idle timeout 30 นาที
  - touch interval 5 นาที
  - จำกัด 3 sessions ต่อ immutable user ID
- Private helpers ที่เพิ่ม:
  - `generateSessionToken_`
  - `hashSessionToken_`
  - `createSession_`
  - `validateSession_`
  - `requireSession_`
  - `revokeSession_`
  - `cleanupExpiredSessions_`
  - `findUserById_`
  - `findUserByUsername_`
- การทดสอบ:
  - JavaScript syntax และ diff checks ผ่าน
  - create → validate → revoke ผ่าน
  - role เปลี่ยนใน user directory แล้ว session อ่านค่าล่าสุด
  - idle expiry และ session limit ผ่าน
  - duplicate username ถูกปฏิเสธแบบ fail closed
- Public RPC ใหม่: ไม่มี
- `loginCheck`/frontend: ยังไม่เปลี่ยน
- R1 maintenance guards: ยังคงอยู่
- `clasp push`/deployment: ยังไม่ได้ดำเนินการสำหรับ R2A
- Rollback target: R1 containment
- งานถัดไป: R2B login/logout integration และ login throttling

### 2026-06-19 — R2B Login, Logout และ Throttling

- ขอบเขต: เชื่อม R2A session foundation กับ login โดยยังไม่แก้ frontend
- Commit: `172de5d46fa3210a6ebe7cf8243ee5e33e2fc779`
- Commit message: `security: issue sessions from login`
- ไฟล์ที่แก้: `Code.js`
- `loginCheck`:
  - รักษา legacy response fields เพื่อไม่ทำให้ frontend เดิมพัง
  - คืน opaque `sessionToken` และเวลาหมดอายุเมื่อ login สำเร็จ
  - ไม่คืน password
  - ใช้ข้อความ failure แบบทั่วไป ไม่เปิดเผยว่ามี username หรือไม่
- Public session RPC ที่เพิ่ม:
  - `getSessionContext`
  - `logoutSession`
- Login throttling:
  - normalize username ก่อนสร้าง throttle key
  - key เป็น SHA-256 hash และไม่เก็บ username ดิบใน Script Properties
  - ผิด 5 ครั้งใน 15 นาทีจะ lockout 15 นาที
  - login สำเร็จล้าง throttle record
- Last login timestamp:
  - ค้นแถวใหม่ด้วย immutable user ID ก่อนเขียน
  - ไม่เชื่อ row number ที่อ่านไว้ก่อนสร้าง session
- การทดสอบ:
  - JavaScript syntax และ diff checks ผ่าน
  - legacy login response compatibility ผ่าน
  - login → context → role refresh → logout ผ่าน
  - raw token ไม่ถูกเก็บฝั่ง server
  - known/unknown username ได้ generic failure เหมือนกัน
  - throttle, lockout และ successful-login reset ผ่าน
  - duplicate username fail closed
  - invalid token และ repeated logout ทำงานตาม contract
  - R1 maintenance early return ยังคง 31 จุดเท่าเดิม
- Review:
  - ไม่พบ Critical/High issue ใหม่
  - ความเสี่ยงคงเหลือ: plaintext password ยังไม่ migrate
  - ความเสี่ยงคงเหลือ: anonymous deployment ไม่มี trusted client IP จึงอาจเกิด targeted account lockout ได้
- Frontend: ยังไม่เปลี่ยนและยังไม่เก็บ token
- Protected endpoints: ยังไม่เปิดกลับ
- `clasp push`/deployment: ยังไม่ได้ดำเนินการสำหรับ R2
- Rollback target: R1 containment
- งานถัดไป: R2C permission map และ `requirePermission_`

### 2026-06-19 — R2C Default-Deny Permission Foundation

- ขอบเขต: permission map และ authorization helper ฝั่ง server เท่านั้น
- Commit: `5a0fe1b1a91c1e8d55f60134eafcafca353be118`
- Commit message: `security: add default deny permission map`
- ไฟล์ที่แก้: `Code.js`
- Permission model:
  - `user`: ใช้ session context ของตนเอง
  - `admin`: ดู admin console/config/snapshot status และทำ monthly-close dry run
  - `superadmin`: เพิ่ม user/config/snapshot management และ monthly-close execute
  - Task mutation และ Export ยังไม่มอบให้ role ใดจนกว่านโยบาย scope จะได้รับอนุมัติ
- Private helpers ที่เพิ่ม:
  - `normalizeAuthRole_`
  - `isKnownPermission_`
  - `getPermissionsForRole_`
  - `hasPermission_`
  - `buildAuthenticatedActor_`
  - `requirePermission_`
- Security behavior:
  - default deny สำหรับ unknown role และ permission ที่ไม่ได้มอบ
  - actor มาจาก validated session และ immutable user ID
  - role อ่านค่าล่าสุดจาก user directory ทุกครั้งที่ validate session
  - unknown permission, forged token และ revoked/expired session ถูกปฏิเสธ
- การทดสอบ:
  - user ถูกปฏิเสธ admin permission
  - admin ทำ dry run ได้แต่ execute monthly close ไม่ได้
  - superadmin ใช้ user management และ monthly-close execute permission ได้
  - Task/Export permission ถูกปฏิเสธทุก role
  - เปลี่ยน role ใน user directory แล้ว permission เปลี่ยนทันที
  - JavaScript syntax และ diff checks ผ่าน
  - ไม่มี public RPC ใหม่
  - ไม่พบ sensitive auth logging
  - R1 maintenance early return ยังคง 31 จุดเท่าเดิม
- Protected endpoints: ยังไม่ผูกกับ `requirePermission_` และยังไม่เปิดกลับ
- `clasp push`/deployment: ยังไม่ได้ดำเนินการสำหรับ R2
- Rollback target: R1 containment
- งานถัดไป: R2D regression/security test gate สำหรับ foundation ทั้งชุด

คัดลอก block นี้สำหรับแต่ละรอบงาน:

```markdown
### YYYY-MM-DD — R? / Phase ?

- Thread/เอกสารอ้างอิง:
- เป้าหมาย:
- ขอบเขตที่อนุมัติ:
- ไฟล์ที่ตรวจ:
- ไฟล์ที่แก้:
- Function ที่แก้:
- พฤติกรรม security ที่เปลี่ยน:
- การทดสอบ:
- ผลการทดสอบ:
- ความเสี่ยงที่พบ:
- การตัดสินใจ:
- การตัดสินใจที่ยัง blocked:
- Rollback notes:
- สถานะ review:
- Commit:
- Deployment:
- งานถัดไป:
```

## 16. สถานะ Review

| หัวข้อ | ผู้ตรวจที่ต้องการ | สถานะ | ตรวจล่าสุด | หลักฐาน/หมายเหตุ |
|---|---|---|---|---|
| Phase 0 finding | เจ้าของโครงการ | ยอมรับแล้ว — Critical | 2026-06-18 | ยืนยัน Execute as Me + Anyone |
| ขอบเขต R1 | เจ้าของโครงการ | อนุมัติแล้ว | 2026-06-18 | R1 containment commit แล้ว |
| R1 code review | เจ้าของโครงการ | ผ่านและ commit แล้ว | 2026-06-19 | Containment `15671078ca9a7048a44458ee05254cd89f275469`; response compatibility `3dd7b3ae832b8b8c25cfd547b726e41238b6f188`; user-management compatibility `465c3d64c7e352dc3605b831dcfa0f1f7df2cf87`; object-response hotfix `c247358b6cf82f32dfaf4fba496e4c119377c845` |
| R1 backup | เจ้าของโครงการ | ผ่าน | 2026-06-18 | `clasp pull` สำเร็จ 7 ไฟล์ที่ `C:\Users\User\testingClash_backup_before_r1` |
| R1 Verification Gate | เจ้าของโครงการ | ผ่าน | 2026-06-18 | Hash ตรงกัน, R1 อยู่ใน history, ไม่พบ `ANYONE_WITH_LINK`, sandbox `clasp status` สะอาด |
| R1 controlled `clasp push` | เจ้าของโครงการ | สำเร็จ | 2026-06-18 | Push 7 ไฟล์จาก `C:\Users\User\testingClash_push_r1`; ไม่ใช้ `--force` |
| R1 Trigger Safety Check | เจ้าของโครงการ | ผ่าน | 2026-06-18 | หน้า Triggers แสดง 0 triggers; Executions ไม่พบ trigger failure จาก R1 |
| R1 manual test gate | เจ้าของโครงการ | ผ่าน | 2026-06-18 | UI ถูก contain, ข้อมูล Task/SystemConfig ไม่เปลี่ยน, ไม่มีไฟล์ Drive ใหม่ และ export ไม่คืน URL |
| อนุมัติ deploy R1 | เจ้าของโครงการ | อนุมัติแล้ว | 2026-06-18 | อนุมัติหลัง R1 Verification Gate และ Manual Test Gate ผ่าน |
| R1 production deployment | เจ้าของโครงการ | สำเร็จ | 2026-06-19 | Deploy เวอร์ชันใหม่ผ่าน Apps Script UI โดยคง deployment เดิม |
| R1 Production Smoke Test | เจ้าของโครงการ | ผ่าน | 2026-06-19 | User Management ไม่ค้างและไม่มี parse error; mutation/export/monthly close ถูกบล็อก; ข้อมูลและ Drive ไม่เปลี่ยน |
| ปิด R1 / Phase 1A | เจ้าของโครงการ | เสร็จสมบูรณ์ | 2026-06-19 | R1 containment คงอยู่เป็น safe rollback baseline สำหรับ R2–R4 |
| R2 session design | เจ้าของโครงการ | R2A ผ่าน review และ commit | 2026-06-19 | เลือก Script Properties; commit `5db29a656b612d7759ee37d18af6dd932e1dd93d`; ยังไม่มี public session RPC และยังไม่ deploy |
| R2A session lifecycle tests | Codex | ผ่าน | 2026-06-19 | create/validate/role refresh/revoke/idle expiry/session limit/duplicate username ผ่าน |
| R2B login/session integration | Codex | ผ่าน review และ commit | 2026-06-19 | Commit `172de5d46fa3210a6ebe7cf8243ee5e33e2fc779`; login ออก token และ legacy frontend contract ยังอยู่ |
| R2B throttling tests | Codex | ผ่าน | 2026-06-19 | generic failure, 5-attempt lockout, reset หลัง login สำเร็จ และ hashed throttle key ผ่าน |
| R2C permission foundation | Codex | ผ่าน review และ commit | 2026-06-19 | Commit `5a0fe1b1a91c1e8d55f60134eafcafca353be118`; default deny และ server-derived actor |
| R2C permission matrix tests | Codex | ผ่าน | 2026-06-19 | user/admin/superadmin, unknown role/permission, forged token และ role refresh ผ่าน |
| R2 deployment | เจ้าของโครงการ | ยังไม่ได้ดำเนินการ | — | Production ยังคง R1 containment |
| R3 permission model | TBD | ยังไม่เริ่ม | — | ติด ownership/export decisions |
| R4 frontend migration | TBD | ยังไม่เริ่ม | — | — |
| R5 final security gate | TBD | ยังไม่เริ่ม | — | — |

## 17. หมายเหตุสุดท้าย

- ห้ามเก็บ secret, token, password, bot credential, private file ID หรือ private deployment URL ในเอกสารนี้
- อัปเดตไฟล์นี้หลัง Codex thread ทุกครั้งที่มีการวิเคราะห์ แก้ไข ทดสอบ review rollback หรือ deploy งาน security
- ใช้ไฟล์นี้เป็นเอกสาร handoff เมื่อ context เต็มหรือย้ายงานไป thread อื่น
- แยกข้อเท็จจริงออกจากข้อสันนิษฐาน
- จุดที่ยังไม่แน่ใจต้องระบุว่าต้องตรวจเพิ่ม
- ห้ามระบุว่า release เสร็จจนกว่า manual test gate และ review จะผ่าน
- ห้าม commit, push, `clasp push` หรือ deploy โดยไม่ได้รับอนุมัติชัดเจน
