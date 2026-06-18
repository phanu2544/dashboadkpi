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
| R1 | Phase 1A — Containment | ปิดพฤติกรรม public/anonymous ที่อันตราย | 1 | วางแผนแล้ว | คง R1 containment |
| R2 | Phase 1B — Session foundation | เพิ่ม server session และ auth helper กลาง | 2 | ยังไม่เริ่ม | R1 |
| R3 | Phase 1C — Server protection | ป้องกัน endpoint สำคัญด้วย permission และ resource scope | 3 | ยังไม่เริ่ม | R1 หรือ R2 รุ่นล่าสุดที่ผ่านการตรวจ |
| R4 | Phase 1D — Frontend token migration | เปลี่ยน frontend ให้ใช้ token และเลิกส่ง identity claim | 4 | ยังไม่เริ่ม | R1 โดยปิด protected features ไว้ |
| R5 | Phase 1E — Test gate | ทดสอบ regression และ security ให้ครบ | 5 | ยังไม่เริ่ม | Protected release ล่าสุดที่ผ่านการตรวจ |

**Release แรกที่ควร deploy:** R1 / Phase 1A — Containment

R1 อาจทำให้ write, admin และ export ใช้งานไม่ได้ชั่วคราว ซึ่งเป็นผลที่ยอมรับได้เพื่อหยุด Critical vulnerability

## 5. งานที่กำลังดำเนินการ

| รายการ | สถานะปัจจุบัน |
|---|---|
| Active release | R1 |
| Active phase | Phase 1A — Containment |
| เป้าหมาย | หยุดการใช้สิทธิ์เจ้าของสคริปต์โดยไม่ได้รับอนุญาต และยังให้หน้าเว็บ render ได้ |
| สถานะ implementation | ยังไม่เริ่ม |
| สถานะ review | อนุมัติแผนแล้ว แต่ยังไม่ได้เตรียม patch |
| สถานะ deployment | ยังไม่ได้ deploy |
| Blocker | ไม่มี blocker สำหรับ R1 containment; หัวข้อที่ 13 block R2/R3/R4 |
| งานถัดไป | เตรียม R1 patch ขนาดเล็กเพื่อ review โดยไม่รวม session implementation |

## 6. เช็กลิสต์ R1 / Phase 1A — Containment

### ควบคุมขอบเขต

- [ ] จำกัด R1 เฉพาะ containment ไม่ทำ session system ทั้งชุด
- [ ] บันทึก public RPC inventory ก่อนเปลี่ยน visibility
- [ ] ตรวจ installed/time-driven triggers ก่อนเปลี่ยนชื่อ function
- [ ] รักษา trigger ที่จำเป็นผ่าน private wrapper หรือ handler ที่อนุมัติ
- [ ] ใช้ maintenance response contract เดียวกันทุก endpoint ที่ปิดชั่วคราว
- [ ] ทุก endpoint ต้องหยุดก่อนเกิด read/write side effect
- [ ] ห้ามแก้ `.clasp.json`
- [ ] ห้ามแก้ `appsscript.json` เว้นแต่มีเหตุผลและอนุมัติแยก
- [ ] ห้าม commit, push, `clasp push` หรือ deploy โดยอัตโนมัติ

### ผลลัพธ์ที่ต้องได้

- [ ] Anonymous visitor เปิดหน้า Web App ได้
- [ ] Anonymous caller แก้ task, user, period, snapshot หรือ configuration ไม่ได้
- [ ] Anonymous caller อ่านข้อมูล admin/monthly close ที่มีสิทธิ์สูงไม่ได้
- [ ] Anonymous caller สร้าง public Drive export ไม่ได้
- [ ] Anonymous caller เรียก Telegram ไม่ได้
- [ ] Anonymous caller เรียก setup, test, repair, cleanup, QA หรือ migration ไม่ได้
- [ ] Identity จาก browser ไม่มีผลต่อสิทธิ์

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

- [ ] `doGet` ทำเพียงสร้าง/evaluate HTML template และกำหนด presentation metadata
- [ ] การเปิดหรือ refresh Web App ไม่สร้าง sheet
- [ ] การเปิดหรือ refresh Web App ไม่เพิ่มหรือแก้ column
- [ ] การเปิดหรือ refresh Web App ไม่เขียน timestamp หรือ configuration
- [ ] ย้าย setup ที่จำเป็นไปเป็น internal/admin process ที่ควบคุมได้
- [ ] กรณี schema ไม่ครบต้อง fail safely และไม่ซ่อมผ่าน anonymous request
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

- [ ] เพิ่ม self-registration policy ที่ควบคุมจาก server
- [ ] หากไม่มีค่า config หรือค่าไม่ถูกต้อง ให้ถือว่าปิด
- [ ] คืน `SECURITY_MAINTENANCE` หรือ registration-disabled response โดยไม่เพิ่มแถว
- [ ] ห้ามรับ registration policy จาก browser
- [ ] ห้ามเปิด self-registration ขณะที่ยังเก็บ password แบบ plaintext
- [ ] ห้ามเปิดเผยว่า username ที่เสนอเป็นบัญชี privileged หรือไม่
- [ ] ย้าย rate limiting และ password migration ไป R2
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

- [ ] `addTask`
- [ ] `deleteTask`
- [ ] `updateTaskDetails`
- [ ] `updateTaskStatus`
- [ ] `updateTaskProgress`
- [ ] `updateTaskProgressOutcome`
- [ ] `updateTaskProgressAndStatus`
- [ ] `cancelTaskMonthlySubmission`

### User และ Admin

- [ ] `getAllUsers`
- [ ] `updateUserRole`
- [ ] `deleteUser`
- [ ] ยืนยันว่า frontend `updateUser` ที่ยังหา server implementation ไม่พบ เรียกโค้ดที่ไม่ได้ review ไม่ได้

### Monthly close, period control และ snapshot

- [ ] `getMonthlyCloseManagementConsoleData`
- [ ] `runDryRunSnapshotForMonthlyCloseConsole`
- [ ] `getDataQualityBeforeClosePeriodForUI`
- [ ] `closeMonthlyPeriod`
- [ ] `runClosePeriodFromMonthlyCloseConsole`
- [ ] `resetMonthlyTaskProgress`
- [ ] `resetPeriodControlToCurrentMonth`
- [ ] `openPreviousMonthInputPeriod`
- [ ] `getBulkReportingScheduleSetupData`
- [ ] `updateBulkReportingSchedules`
- [ ] `saveSnapshotConfig`
- [ ] `snapshotNow`

### Export

- [ ] `exportTasksToCSV`
- [ ] `createHTMLDownloadUrl`
- [ ] `createCSVDownloadUrl`
- [ ] `exportMonthlyClosedReportCsv`
- [ ] `exportMonthlyClosedRawDataCsv`
- [ ] ยืนยันว่า endpoint ที่ปิดไม่สร้างไฟล์ Drive
- [ ] ยืนยันว่าไม่มีไฟล์ใหม่ถูกแชร์ด้วย `DriveApp.Access.ANYONE_WITH_LINK`
- [ ] ปิด Drive URL export ต่อไปจนกว่า R3 authorization จะเสร็จ
- [ ] ใน R4 ให้ใช้ authenticated response content และ browser-local `Blob`

### การจัดการ Identity

- [ ] ไม่ใช้ `currentUsername` เพื่อ authorize
- [ ] ไม่ใช้ `role` จาก browser เพื่อ authorize
- [ ] ไม่ใช้ `submittedBy`; ในอนาคตให้ดึงจาก validated session
- [ ] ไม่ใช้ `cancelledBy`; ในอนาคตให้ดึงจาก validated session
- [ ] ระหว่าง containment ห้ามเขียน actor จาก browser ลง audit log

ความเสี่ยงเมื่อ rollback:

- กระทบ availability สูง เพราะ write/admin/export จะใช้งานไม่ได้
- ความเสี่ยงต่อ data integrity ต่ำ เพราะ endpoint ต้องไม่มี side effect
- การ rollback ไปก่อน R1 จะทำให้ Critical vulnerability กลับมา

## 10. ทำ Telegram และ Internal Functions ให้เป็น Private

ไฟล์เป้าหมาย: `Code.js`

### Telegram และ Integration

- [ ] เปลี่ยน `sendMessage` เป็น `sendMessage_` และแก้ internal references
- [ ] เปลี่ยน `sendLongMessage` เป็น `sendLongMessage_`
- [ ] เปลี่ยน `notifyGroup` เป็น `notifyGroup_`
- [ ] เปลี่ยน `notifySnapshotFromSheet` เป็น `notifySnapshotFromSheet_`
- [ ] เปลี่ยน `createSnapshotFileInDrive` เป็น `createSnapshotFileInDrive_`
- [ ] เปลี่ยน `testNotify` เป็น `testNotify_`
- [ ] เก็บ bot token ใน server properties เท่านั้น
- [ ] Browser RPC ต้องกำหนด Telegram `chatId` เองไม่ได้
- [ ] ให้ `doPost` ไม่มี side effect จนกว่าจะออกแบบ webhook authentication

### Setup และ Internal Maintenance

- [ ] ทำ setup functions ให้เป็น private/internal:
  - `setupSheet`
  - `setupHistorySheet`
  - `setupPeriodControlSheet`
  - `setupSubDepConfigSheet`
  - `setupPeriodActionLogSheet`
  - `ensureInputStatusColumns`
- [ ] ทำ maintenance/trigger functions ให้เป็น private/internal:
  - `manualTriggerWithConfig`
  - `recalculateAllAchievements`
  - `clearMonthlyInputForActivePeriod`
- [ ] ตรวจ installed triggers ก่อนเปลี่ยนชื่อ handler
- [ ] ระบุเหตุผลของ function ที่จำเป็นต้องคงเป็น trigger entry point

### Test, QA, Repair และ Migration

- [ ] ทำ function ที่ขึ้นต้นด้วย `test` ทุกตัวให้เป็น private/internal
- [ ] ทำ function ที่ขึ้นต้นด้วย `step` ทุกตัวให้เป็น private/internal
- [ ] ทำ repair functions ให้เป็น private/internal:
  - `repairActivePeriodKey`
  - `repairPeriodKeysToTextOnce`
  - `repairLevelTargetFieldsForDQ`
  - `repairBlankReportingFieldsInHistory202611`
- [ ] ทำ QA cleanup functions ให้เป็น private/internal:
  - `findQaPartialSnapshotRowsForActivePeriod`
  - `deleteQaPartialSnapshotRowsForActivePeriod`
  - `findTestSnapshotRowsForActivePeriod`
  - `deleteTestSnapshotRowsForActivePeriod`
- [ ] ทำ verification/preview maintenance functions ให้เป็น private/internal:
  - `verifyClosedPeriodSnapshotCompleteness_202611`
  - `previewBlankReportingFieldsInHistory202611`
- [ ] ทำ `migrateTaskDataMasterToDevSchema` ให้เป็น private/internal
- [ ] สำรวจ public functions ใหม่อีกครั้งหลัง rename
- [ ] ยืนยันว่า frontend ไม่อ้างถึง function ที่เปลี่ยนเป็น private

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

- [ ] ใช้ machine-readable code `SECURITY_MAINTENANCE`
- [ ] ห้ามส่ง stack trace, sheet name, file ID, deployment URL, username, role, token หรือ secret
- [ ] คืน response ก่อน mutation, Drive creation, Telegram request หรือ privileged read
- [ ] ใช้ response shape เดียวกันทุก endpoint
- [ ] Frontend แสดงข้อความทั่วไปได้ แต่ห้ามใช้ response นี้เพื่อตัดสิน authorization
- [ ] บันทึกชื่อ endpoint ใน server log ได้เมื่อ log ไม่มี sensitive payload
- [ ] ตัดสินใจให้ชัดว่า RPC ที่เดิมคืน string จะคืน JSON string หรือ structured object ใน R1

## 12. Manual Test Gate สำหรับ R1

ห้าม deploy R1 จนกว่าการทดสอบที่เกี่ยวข้องจะผ่าน

### Render-only

- [ ] บันทึกรายชื่อ sheet, จำนวน header และ timestamp ที่เกี่ยวข้องก่อนทดสอบ
- [ ] เปิด Web App แบบ anonymous
- [ ] Refresh หลายครั้ง
- [ ] ยืนยันว่า schema และข้อมูลไม่เปลี่ยน
- [ ] ยืนยันว่า application shell render ได้

### Registration

- [ ] ทดลองสมัครเมื่อไม่มี policy config
- [ ] ทดลองสมัครเมื่อ policy config ไม่ถูกต้อง
- [ ] ยืนยันว่าทั้งสองกรณีถูกปฏิเสธ
- [ ] ยืนยันว่าไม่มีแถวเพิ่มในชีต `login`

### Mutation, Admin และ Monthly Close

- [ ] เรียก task mutation ทุกตัวโดยไม่ login
- [ ] เรียก endpoint โดยปลอม username ของ superadmin
- [ ] เรียก monthly-close, period-control และ snapshot endpoint โดยตรง
- [ ] ยืนยันว่าทุกตัวคืน `SECURITY_MAINTENANCE`
- [ ] ยืนยันว่า task, user, history, period และ configuration ไม่เปลี่ยน

### Export และ Drive

- [ ] เรียก export endpoint ทุกตัวโดยตรง
- [ ] ยืนยันว่าไม่มีไฟล์ Drive ถูกสร้าง
- [ ] ยืนยันว่าไม่มีไฟล์กลายเป็น `ANYONE_WITH_LINK`
- [ ] ยืนยันว่าไม่มี download URL ถูกส่งกลับ

### Telegram และ Internal RPC

- [ ] ทดลอง `google.script.run.sendMessage(...)` และยืนยันว่าเรียกไม่ได้
- [ ] ทดลองเรียก setup, test, repair, QA cleanup และ migration RPC ตัวอย่าง
- [ ] ยืนยันว่า private/internal functions เรียกผ่าน `google.script.run` ไม่ได้
- [ ] ยืนยันว่าไม่มี Telegram request ถูกส่ง
- [ ] ยืนยันว่าไม่มี schema repair หรือ migration เกิดขึ้น

### Trigger Safety

- [ ] ทำ inventory ของ installed triggers ก่อน R1
- [ ] ตรวจ trigger ที่อนุมัติทุกตัวหลัง rename
- [ ] บันทึกและแสดง trigger failure อย่างชัดเจน

### Source Review

- [ ] สำรวจ public functions ใหม่ทั้งหมด
- [ ] ตรวจ public function ที่เหลือทุกตัวเทียบกับ allowlist
- [ ] ค้นหา `ANYONE_WITH_LINK`
- [ ] ค้นหาการใช้ browser actor fields ใน authorization หรือ audit write
- [ ] ตรวจ `git diff` และยืนยันว่าแก้เฉพาะไฟล์ที่อนุมัติ
- [ ] ขออนุมัติก่อน commit, push, `clasp push` หรือ deploy

ผล Review R1:

- [ ] ผ่าน
- [ ] ไม่ผ่าน
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
| Session storage | ใช้ Script Properties, dedicated sheet หรือ server store อื่น รวมถึง expiry/capacity | TBD | Blocked | R2 session |

เช็กลิสต์การบันทึกการตัดสินใจ:

- [ ] บันทึกตัวเลือกและเหตุผล
- [ ] บันทึกผู้อนุมัติและวันที่
- [ ] บันทึก permission/endpoint ที่ได้รับผลกระทบ
- [ ] บันทึกผลกระทบต่อ migration และ rollback

## 14. Placeholder สำหรับ Release ถัดไป

### R2 / Phase 1B — Session Foundation

สถานะ: ยังไม่เริ่ม

- [ ] ออก opaque session token จาก server
- [ ] เก็บเฉพาะ token hash ฝั่ง server
- [ ] มี expiry, idle timeout, revocation และ cleanup
- [ ] เพิ่ม `logout` endpoint
- [ ] ผูก session กับ immutable user ID
- [ ] เพิ่ม `requireSession_` และ `requirePermission_`
- [ ] เพิ่ม login throttling
- [ ] วางแผน password hashing และ plaintext migration
- [ ] ยังไม่เปิด critical endpoint ใน foundation-only deployment

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
| R1 code review | เจ้าของโครงการ | ผ่านและ commit แล้ว | 2026-06-18 | `15671078ca9a7048a44458ee05254cd89f275469` — `security: contain unsafe public rpc surface`; เปลี่ยนเฉพาะ `Code.js` |
| R1 manual test gate | TBD | รอดำเนินการ | — | ยังไม่อนุมัติ deploy จนกว่า manual test gate จะผ่าน |
| อนุมัติ deploy R1 | เจ้าของโครงการ | ยังไม่ได้ขอ | — | ยังไม่ได้รับอนุญาตให้ deploy |
| R2 session design | TBD | ยังไม่เริ่ม | — | ติด session storage decision |
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
