/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Script to limit the scope of file access for this script
 * to only the current document. This is a best practice for security.
 */
// --- GLOBAL VARIABLES ---
// กำหนดชื่อชีตและคอลัมน์ส่วนหัว
/*=== sheet ตาราง Taskdata ===*/

const SHEET_NAME = 'TaskData';

const HEADERS = [
  'ID', 'Task', 'Department', 'Assignee', 'Priority', 'Status',
  'Progress', 'Timestamp', 'UpdatedAt', 'Challenges', 'NextSteps',
  'Deadline', 'SubDep', 'Baseline', 'ProgressP', 'ProgressH', 'ProgressR',
  'BaselineUnit', 'ProgressMode', 'OutcomeUnit', 'Outcomes', 'PassOutcomes',
  'ProgressOutcome','Link', 'WorkGroup',

// ✅ Evaluation Rule Fields
'EvaluateMode',
'TargetOperator',
'TargetValue',
'TargetText',

// ✅ Calculated Result Fields
'ResultValue',
'ResultText',
'ResultLevelText',
'ResultLevelRank',
'TargetLevelText',
'TargetLevelRank',
'LevelOrder',
'AchievementStatus',
'AchievementText',

// ✅ Monthly Input Status Fields
'InputStatus',
'InputPeriodKey',
'InputPeriodLabel',
'SubmittedAt',
'SubmittedBy',

// ✅ Reporting Schedule Fields
'ReportingFrequency',
'ReportingMonths'

];

const HISTORY_HEADERS = [
  // ===============================
  // ✅ Old Core Fields - ห้ามเปลี่ยนลำดับชุดเดิม
  // เพื่อไม่ให้ข้อมูลเก่าใน TaskHistory เพี้ยน
  // ===============================
  'HistoryID',
  'TaskID',
  'TaskName',
  'PeriodLabel',
  'PeriodStart',
  'PeriodEnd',
  'Status',
  'ProgressMode',
  'Progress',
  'ProgressOutcome',
  'BaselineUnit',
  'Outcomes',
  'PassOutcomes',
  'Challenges',
  'NextSteps',
  'RecordedAt',

  // ===============================
  // ✅ Snapshot Control Fields
  // ใช้บอกว่าข้อมูลนี้มาจากการ snapshot รอบไหน
  // ===============================
  'SnapshotRunID',
  'SnapshotAt',
  'SnapshotBy',

  // ===============================
  // ✅ Monthly Input Fields
  // ใช้ทำกราฟรายเดือน / ตรวจว่ากรอกข้อมูลแล้วหรือยัง
  // ===============================
  'InputStatus',
  'InputPeriodKey',
  'InputPeriodLabel',
  'SubmittedAt',
  'SubmittedBy',

  // ===============================
  // ✅ Task Metadata Fields
  // ใช้ filter / รายงาน / export
  // ===============================
  'Department',
  'WorkGroup',
  'Assignee',
  'Priority',
  'Deadline',
  'SubDep',
  'SubDepLabel',
  'Link',

  // ✅ Reporting Schedule Snapshot Fields
'ReportingFrequency',
'ReportingMonths',
'IsDueThisPeriod',
'ReportingStatus',

  // ===============================
  // ✅ Baseline / Progress Detail Fields
  // เก็บรายละเอียดเดิมของตัวชี้วัดให้ครบ
  // ===============================
  'Baseline',
  'ProgressP',
  'ProgressH',
  'ProgressR',
  'OutcomeUnit',

  // ===============================
  // ✅ Evaluation Rule Fields
  // ใช้ดูว่าแต่ละตัวชี้วัดประเมินแบบไหน
  // ===============================
  'EvaluateMode',
  'TargetOperator',
  'TargetValue',
  'TargetText',
  'LevelOrder',

  // ===============================
  // ✅ Calculated Result Fields
  // ใช้ทำกราฟผลประเมินและรายงานผู้บริหาร
  // ===============================
  'ResultValue',
  'ResultText',
  'ResultLevelText',
  'ResultLevelRank',
  'TargetLevelText',
  'TargetLevelRank',
  'AchievementStatus',
  'AchievementText'
];

const TELEGRAM_BOT_TOKEN_PROPERTY_KEY = "BOT_TOKEN";
const TELEGRAM_ALERT_CHAT_ID_PROPERTY_KEY = "ALERT_CHAT_ID";

function getTelegramConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    botToken: String(props.getProperty(TELEGRAM_BOT_TOKEN_PROPERTY_KEY) || "").trim(),
    alertChatId: String(props.getProperty(TELEGRAM_ALERT_CHAT_ID_PROPERTY_KEY) || "").trim()
  };
}

function sendTelegramAlert_(message) {
  const config = getTelegramConfig_();
  if (!config.alertChatId) return;
  sendMessage(config.alertChatId, message);
}
/* function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
} */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


function touchUpdatedAt(sheet, rowIndex) {
  const col = HEADERS.indexOf('UpdatedAt');
  if (col !== -1) {
    sheet.getRange(rowIndex, col + 1).setValue(new Date());
  }
}

      function getUserRoleByUsername_(username) {
      if (!username) return "";

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("login");
      if (!sheet) return "";

      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return "";

      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const usernameCol = headers.indexOf("username");
      const roleCol = headers.indexOf("role");

      if (usernameCol === -1 || roleCol === -1) return "";

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][usernameCol]).trim() === String(username).trim()) {
          return String(data[i][roleCol] || "").trim();
        }
      }

      return "";
    }

    function requireSuperAdmin_(username) {
      const role = getUserRoleByUsername_(username);

      if (role !== "superadmin") {
        throw new Error("อนุญาตเฉพาะ superadmin เท่านั้น");
      }

      return true;
    }

    function requireAdminConsoleViewer_(username) {
      const role = getUserRoleByUsername_(username);

      if (role !== "admin" && role !== "superadmin") {
        throw new Error("Admin console is available for admin or superadmin only");
      }

      return role;
    }

    function normalizeBooleanConfigValue_(value) {
      if (value === true || value === false) return value;

      const text = String(value === null || value === undefined ? "" : value)
        .trim()
        .toLowerCase();

      if (!text) return value;

      if (["true", "1", "yes", "y", "on"].indexOf(text) !== -1) {
        return true;
      }

      if (["false", "0", "no", "n", "off"].indexOf(text) !== -1) {
        return false;
      }

      return value;
    }

// ✅ สมัครสมาชิกใหม่


/**
 * ฟังก์ชันหลักในการแสดงผลหน้าเว็บ
 * @param {object} e - The event parameter.
 * @returns {HtmlOutput} The HTML output for the web app.
 */
function doGet(e) {
  setupSheet();
  setupHistorySheet();

  // ✅ ตรวจสอบ/เพิ่มคอลัมน์สถานะการกรอกข้อมูลรายเดือน
  ensureInputStatusColumns();

  const htmlTemplate = HtmlService.createTemplateFromFile('index.html');
  htmlTemplate.url = ScriptApp.getService().getUrl(); // ส่ง URL ของเว็บแอปไปยัง HTML
  return htmlTemplate
    .evaluate()
    .setTitle('ระบบติดตามตัวชี้วัดประจำปีงบประมาณ 2569')
    .setFaviconUrl('https://sv1.img.in.th/7OF8qX.png');
}

/** ================================
 *  🔹 โหลดข้อมูลงานจากชีต
 * ================================ */
function getTasks() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return JSON.stringify([]);

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return JSON.stringify([]);

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const tasks = values.map(row =>
      Object.fromEntries(headers.map((h, i) => [h, row[i]]))
    );

    return JSON.stringify(tasks);
  } catch (error) {
    console.error("Error getting tasks:", error);
    return JSON.stringify({ error: "Failed to get tasks." });
  }
}


/** ================================
 *  🔹 โหลดข้อมูลงานเฉพาะปี (สำหรับกราฟ)
 * ================================ */
function getTasksByYear(year) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return JSON.stringify({ error: "ไม่พบชีต TaskData" });

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return JSON.stringify([]);

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const timestampIdx = headers.indexOf("Timestamp");
    const filtered = values.filter(row => {
      const ts = row[timestampIdx];
      if (!ts) return false;
      const d = new Date(ts);
      return d.getFullYear() === year;
    });

    const result = filtered.map(row =>
      Object.fromEntries(headers.map((h, i) => [h, row[i]]))
    );

    return JSON.stringify(result);
  } catch (error) {
    console.error("Error getting tasks by year:", error);
    return JSON.stringify({ error: "Failed to get tasks by year." });
  }
}


/**
 * ฟังก์ชันสำหรับลบงาน
 * @param {string} taskId - The ID of the task to delete.
 * @returns {string} A JSON string with the result.
 */
function deleteTask(taskId) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const idColumnIndex = HEADERS.indexOf('ID');

    if (idColumnIndex === -1) {
      throw new Error("ID column not found.");
    }

    // Find the row with matching ID (start from row 2 as row 1 is header)
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] === taskId) {
        sheet.deleteRow(i + 1); // +1 because sheet rows are 1-based
        return JSON.stringify({ success: true, message: 'ลบงานเรียบร้อยแล้ว' });
      }
    }

    return JSON.stringify({ success: false, message: 'ไม่พบงาน.' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return JSON.stringify({ success: false, message: 'เกิดข้อผิดพลาดขณะลบงาน.' });
  }
}
/**
 * ฟังก์ชันสำหรับให้ฝั่ง Client (HTML) เรียกใช้เพื่อดึงข้อมูลทั้งหมด
 * @returns {string} A JSON string representing the tasks.
 */

/**
 * Exports tasks to CSV within a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {string} CSV data
 */
function exportTasksToCSV(startDate, endDate) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return "No data available";
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    // Filter tasks within date range
    const timestampIndex = headers.indexOf('Timestamp');
    const filteredTasks = data.filter(row => {
      const taskDate = new Date(row[timestampIndex]);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1); // Include all of end date

      return taskDate >= start && taskDate <= end;
    });

    // Convert to CSV with UTF-8 BOM for proper Lao character support
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += headers.join(',') + '\n';

    filteredTasks.forEach(row => {
      csv += row.map(field => {
        // Convert to string and handle special characters
        const strValue = String(field);

        // Escape quotes and wrap in quotes if contains comma or newline
        if (typeof field === 'string' && (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"'))) {
          return '"' + strValue.replace(/"/g, '""') + '"';
        }
        return strValue;
      }).join(',') + '\n';
    });

    return csv;
  } catch (error) {
    console.error('Error exporting tasks:', error);
    return "Error generating CSV";
  }
}



/**
 * Creates a download URL for the CSV file
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {string} Download URL
 */
function createHTMLDownloadUrl(startDate, endDate) {
  try {
    const tasks = getFilteredTasks(startDate, endDate); // You'd need to implement this
    const htmlContent = generateStyledHTML(tasks); // You'd need to implement this

    const fileName = `tasks_export_${startDate}_to_${endDate}.html`;
    const file = DriveApp.createFile(fileName, htmlContent, MimeType.HTML);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getDownloadUrl();
  } catch (error) {
    console.error('Error creating HTML download URL:', error);
    throw new Error('Failed to create download URL');
  }
}

// Helper function to generate styled HTML
function generateStyledHTML(tasks) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Tasks Export</title>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Noto Sans Lao', sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>Tasks Report</h1>
      <table>
        <tr>
          ${HEADERS.map(h => `<th>${h}</th>`).join('')}
        </tr>
        ${tasks.map(task => `
          <tr>
            ${HEADERS.map(header => `<td>${task[header] || ''}</td>`).join('')}
          </tr>
        `).join('')}
      </table>
    </body>
    </html>
  `;
  return html;
}
function createCSVDownloadUrl(startDate, endDate) {
  try {
    const csvData = exportTasksToCSV(startDate, endDate);
    const fileName = `tasks_export_${startDate}_to_${endDate}.csv`;

    // Create a file in the root folder of the user's Drive
    const file = DriveApp.createFile(fileName, csvData, MimeType.CSV);

    // Set the file to be viewable by anyone with the link (adjust permissions as needed)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Return the download URL
    return file.getDownloadUrl();
  } catch (error) {
    console.error('Error creating CSV download URL:', error);
    throw new Error('Failed to create download URL');
  }
}
/**
 * ฟังก์ชันสำหรับเพิ่มงานใหม่ลงในชีต
 * @param {object} taskObject - The task object to add.
 * @returns {string} A JSON string with the result.
 */
function addTask(taskObject) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || setupSheet();

    const newId = Utilities.getUuid();
    const timestamp = new Date();

    // ✅ กันพลาด BaselineUnit ถ้าเป็น percent 
    if (taskObject.progressMode === "percent" || taskObject.evaluateMode === "percent") {
      taskObject.baselineUnit = "ร้อยละ";
    }

    const lastCol = sheet.getLastColumn();
    const headers = sheet
      .getRange(1, 1, 1, lastCol)
      .getValues()[0]
      .map(h => String(h || "").trim());

    const toCsv = function(value) {
      if (Array.isArray(value)) return value.join(",");
      return value || "";
    };

    // ✅ สร้าง object ตามชื่อคอลัมน์จริง
    // ใช้ valueOrBlank_ เพื่อให้ 0 ไม่หาย
    const rowObject = {
      ID: newId,
      Task: taskObject.task || "",
      Department: taskObject.department || "",
      Assignee: taskObject.assignee || "",
      Priority: taskObject.priority || "Medium",
      Status: "Pending",

      Progress: valueOrBlank_(taskObject.progress),
      Timestamp: timestamp,
      UpdatedAt: timestamp,
      Challenges: taskObject.challenges || "",
      NextSteps: taskObject.nextSteps || "",
      Deadline: taskObject.deadline || "",
      SubDep: taskObject.subDep || "",

      Baseline: valueOrBlank_(taskObject.baseline),
      ProgressP: valueOrBlank_(taskObject.progressP),
      ProgressH: valueOrBlank_(taskObject.progressH),
      ProgressR: valueOrBlank_(taskObject.progressR),

      BaselineUnit: taskObject.baselineUnit || "",
      ProgressMode: taskObject.progressMode || "",
      OutcomeUnit: taskObject.outcomeUnit || "",
      Outcomes: toCsv(taskObject.outcomes),
      PassOutcomes: toCsv(taskObject.passOutcomes),
      ProgressOutcome: valueOrBlank_(taskObject.progressOutcome),

      Link: taskObject.link || "",
      WorkGroup: taskObject.workgroup || taskObject.workGroup || "",

      // ✅ Reporting Schedule Fields
      ReportingFrequency: normalizeReportingFrequencyInput_(
        taskObject.reportingFrequency
      ),
      ReportingMonths: normalizeReportingMonthsInput_(
        taskObject.reportingMonths,
        taskObject.reportingFrequency
      ),

      // ✅ Evaluation Rule Fields
      EvaluateMode: taskObject.evaluateMode || "",
      TargetOperator: taskObject.targetOperator || "",
      TargetValue: valueOrBlank_(taskObject.targetValue),
      TargetText: taskObject.targetText || "",
      LevelOrder: taskObject.levelOrder || "",

      // ✅ Calculated Result Fields
      ResultValue: "",
      ResultText: "-",
      ResultLevelText: "",
      ResultLevelRank: "",
      TargetLevelText: "",
      TargetLevelRank: "",
      AchievementStatus: "NoData",
      AchievementText: "ไม่มีข้อมูล",

      // ✅ Monthly Input Status Fields
      InputStatus: "NotSubmitted",
      InputPeriodKey: "",
      InputPeriodLabel: "",
      SubmittedAt: "",
      SubmittedBy: ""
    };

    // ✅ เรียงข้อมูลตาม header จริงในชีต
    const newRow = headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(rowObject, header)
        ? rowObject[header]
        : "";
    });

    const newRowIndex = sheet.getLastRow() + 1;

    sheet
      .getRange(newRowIndex, 1, 1, headers.length)
      .setValues([newRow]);

    // ✅ คำนวณผลประเมินหลังเพิ่มแถว
    updateAchievementForRow(sheet, newRowIndex);

    // ✅ ถ้าเพิ่มงานพร้อมกรอกผล เช่น Progress = 0 ให้ถือว่า Submitted
    if (hasMonthlyInput(taskObject)) {
      markTaskSubmittedForRow(
        sheet,
        newRowIndex,
        taskObject.submittedBy || ""
      );
    }

    touchUpdatedAt(sheet, newRowIndex);

    return JSON.stringify({
      success: true,
      message: "เพิ่มงานเรียบร้อยแล้ว"
    });

  } catch (error) {
    console.error("Error adding task:", error);
    return JSON.stringify({
      success: false,
      message: "เกิดข้อผิดพลาดขณะเพิ่มงาน: " + error.message
    });
  }
}

/**
 * ฟังก์ชันสำหรับอัปเดตสถานะของงาน
 * @param {string} taskId - The ID of the task to update.
 * @param {string} newStatus - The new status of the task.
 * @returns {string} A JSON string with the result.
 */
function updateTaskStatus(taskId, newStatus) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const idColumnIndex = HEADERS.indexOf('ID');
    const statusColumnIndex = HEADERS.indexOf('Status');

    if (idColumnIndex === -1 || statusColumnIndex === -1) {
      throw new Error("ID or Status column not found.");
    }

    // หาแถวที่มี ID ตรงกัน (เริ่มหาจากแถวที่ 2 เพราะแถวแรกเป็น header)
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] === taskId) {
        // อัปเดตสถานะในคอลัมน์ Status (index + 1 เพราะ getRange เป็น 1-based)
        sheet.getRange(i + 1, statusColumnIndex + 1).setValue(newStatus);
        touchUpdatedAt(sheet, i + 1);
        return JSON.stringify({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
      }
    }

    return JSON.stringify({ success: false, message: 'ไม่พบงานที่คุณต้องการอัปเดต.' });
  } catch (error) {
    console.error('Error updating task status:', error);
    return JSON.stringify({ success: false, message: 'เกิดข้อผิดพลาดขณะอัปเดต.' });
  }
}

/**
 * ฟังก์ชันสำหรับอัปเดตความคืบหน้าของงาน
 * @param {string} taskId - The ID of the task to update.
 * @param {number} progress - The new progress value (0-100).
 * @returns {string} A JSON string with the result.
 */
function updateTaskProgress(taskId, progress) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const idColumnIndex = HEADERS.indexOf('ID');
    const progressColumnIndex = HEADERS.indexOf('Progress');

    if (idColumnIndex === -1 || progressColumnIndex === -1) {
      throw new Error("ID or Progress column not found.");
    }

    // หาแถวที่มี ID ตรงกัน (เริ่มหาจากแถวที่ 2 เพราะแถวแรกเป็น header)
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] === taskId) {
        // อัปเดตความคืบหน้าในคอลัมน์ Progress (index + 1 เพราะ getRange เป็น 1-based)
        sheet.getRange(i + 1, progressColumnIndex + 1).setValue(progress);

        // ✅ คำนวณผลบรรลุ/ไม่บรรลุใหม่ทันที
        updateAchievementForRow(sheet, i + 1);

        // ✅ กรอกผลแบบตัวเลขแล้ว
        markTaskSubmittedForRow(sheet, i + 1, '');

        touchUpdatedAt(sheet, i + 1);

        return JSON.stringify({
          success: true,
          message: 'อัปเดตความคืบหน้าและผลประเมินเรียบร้อยแล้ว'
        });
      }
    }

    return JSON.stringify({ success: false, message: 'ไม่พบงานที่คุณต้องการอัปเดต.' });
  } catch (error) {
    console.error('Error updating task progress:', error);
    return JSON.stringify({ success: false, message: 'เกิดข้อผิดพลาดขณะอัปเดตความคืบหน้า.' });
  }
}

// ✅ อัปเดต ProgressOutcome (custom mode)
function updateTaskProgressOutcome(taskId, value) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    const idColumnIndex = HEADERS.indexOf("ID");
    const progressOutcomeColumnIndex = HEADERS.indexOf("ProgressOutcome");

    if (idColumnIndex === -1 || progressOutcomeColumnIndex === -1) {
      throw new Error("Column not found.");
    }

    // ✅ หา Task ID
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] === taskId) {

        sheet.getRange(i + 1, progressOutcomeColumnIndex + 1)
        .setValue(value);

          // ✅ คำนวณผลบรรลุ/ไม่บรรลุใหม่ทันที
          updateAchievementForRow(sheet, i + 1);

          // ✅ กรอกผลแบบระดับ / ผ่านไม่ผ่านแล้ว
          markTaskSubmittedForRow(sheet, i + 1, '');

          touchUpdatedAt(sheet, i + 1);

          return JSON.stringify({
            success: true,
            message: "✅ อัปเดตผลดำเนินการและผลประเมินแล้ว"
          });
      }
    }

    return JSON.stringify({
      success: false,
      message: "❌ ไม่พบ Task ID"
    });

  } catch (error) {
    console.error("Error updateTaskProgressOutcome:", error);

    return JSON.stringify({
      success: false,
      message: "เกิดข้อผิดพลาดขณะอัปเดต ProgressOutcome"
    });
  }
}

function hasRealValue_(value) {
  return value !== null &&
         value !== undefined &&
         String(value).trim() !== "";
}

function valueOrBlank_(value) {
  return hasRealValue_(value) ? value : "";
}

/**
 * ฟังก์ชันสำหรับอัปเดตความท้าทายและขั้นตอนต่อไป
 * @param {string} taskId - The ID of the task to update.
 * @param {string} challenges - The challenges text.
 * @param {string} nextSteps - The next steps text.
 * @returns {string} A JSON string with the result.
 */
function updateTaskDetails(taskObject) {
  try {
    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error("ไม่พบชีต " + SHEET_NAME);
    }

    const data = sheet.getDataRange().getValues();

    if (!data || data.length < 2) {
      return JSON.stringify({
        success: false,
        message: "ไม่พบข้อมูลตัวชี้วัดในชีต"
      });
    }

    // ✅ สำคัญ: ใช้ header จริงจากชีต ไม่ใช้ HEADERS
    // เพราะคอลัมน์ใหม่อาจถูก append ไปท้ายชีต
    const sheetHeaders = data[0].map(function(h) {
      return String(h || "").trim();
    });

    const idColumnIndex = sheetHeaders.indexOf("ID");
    const taskColumnIndex = sheetHeaders.indexOf("Task");
    const departmentColumnIndex = sheetHeaders.indexOf("Department");
    const assigneeColumnIndex = sheetHeaders.indexOf("Assignee");
    const priorityColumnIndex = sheetHeaders.indexOf("Priority");
    const challengesColumnIndex = sheetHeaders.indexOf("Challenges");
    const nextStepsColumnIndex = sheetHeaders.indexOf("NextSteps");
    const deadlineColumnIndex = sheetHeaders.indexOf("Deadline");
    const subDepColumnIndex = sheetHeaders.indexOf("SubDep");

    const baselineColumnIndex = sheetHeaders.indexOf("Baseline");
    const progressPColumnIndex = sheetHeaders.indexOf("ProgressP");
    const progressHColumnIndex = sheetHeaders.indexOf("ProgressH");
    const progressRColumnIndex = sheetHeaders.indexOf("ProgressR");
    const progressColumnIndex = sheetHeaders.indexOf("Progress");
    const progressOutcomeColumnIndex = sheetHeaders.indexOf("ProgressOutcome");

    const baselineUnitColumnIndex = sheetHeaders.indexOf("BaselineUnit");
    const progressModeColumnIndex = sheetHeaders.indexOf("ProgressMode");
    const passOutcomesColumnIndex = sheetHeaders.indexOf("PassOutcomes");
    const outcomesColumnIndex = sheetHeaders.indexOf("Outcomes");

    const linkColumnIndex = sheetHeaders.indexOf("Link");
    const workGroupColumnIndex = sheetHeaders.indexOf("WorkGroup");

    // ✅ Reporting Schedule Fields
    const reportingFrequencyColumnIndex = sheetHeaders.indexOf("ReportingFrequency");
    const reportingMonthsColumnIndex = sheetHeaders.indexOf("ReportingMonths");

    // ✅ Evaluation Rule Fields
    const evaluateModeColumnIndex = sheetHeaders.indexOf("EvaluateMode");
    const targetOperatorColumnIndex = sheetHeaders.indexOf("TargetOperator");
    const targetValueColumnIndex = sheetHeaders.indexOf("TargetValue");
    const targetTextColumnIndex = sheetHeaders.indexOf("TargetText");
    const levelOrderColumnIndex = sheetHeaders.indexOf("LevelOrder");

    if (idColumnIndex === -1) {
      throw new Error("ID column not found.");
    }

    const targetTaskId = String(taskObject.id || "").trim();

    if (!targetTaskId) {
      return JSON.stringify({
        success: false,
        message: "ไม่พบรหัสตัวชี้วัดที่ต้องการอัปเดต"
      });
    }

    const toCsv = function(value) {
      if (Array.isArray(value)) return value.join(",");
      return value || "";
    };

    for (let i = 1; i < data.length; i++) {
      const rowTaskId = String(data[i][idColumnIndex] || "").trim();

      if (rowTaskId !== targetTaskId) {
        continue;
      }

      const rowNumber = i + 1;

      // ✅ AUTO SET BaselineUnit ถ้าเป็น percent
      if (
        taskObject.progressMode === "percent" ||
        taskObject.evaluateMode === "percent"
      ) {
        taskObject.baselineUnit = "ร้อยละ";
      }

      // ===============================
      // ✅ Basic Metadata
      // ===============================
      if (taskColumnIndex !== -1) {
        sheet.getRange(rowNumber, taskColumnIndex + 1)
          .setValue(taskObject.task || "");
      }

      if (departmentColumnIndex !== -1) {
        sheet.getRange(rowNumber, departmentColumnIndex + 1)
          .setValue(taskObject.department || "");
      }

      if (assigneeColumnIndex !== -1) {
        sheet.getRange(rowNumber, assigneeColumnIndex + 1)
          .setValue(taskObject.assignee || "");
      }

      if (priorityColumnIndex !== -1) {
        sheet.getRange(rowNumber, priorityColumnIndex + 1)
          .setValue(taskObject.priority || "Medium");
      }

      if (challengesColumnIndex !== -1) {
        sheet.getRange(rowNumber, challengesColumnIndex + 1)
          .setValue(taskObject.challenges || "");
      }

      if (nextStepsColumnIndex !== -1) {
        sheet.getRange(rowNumber, nextStepsColumnIndex + 1)
          .setValue(taskObject.nextSteps || "");
      }

      if (deadlineColumnIndex !== -1) {
        sheet.getRange(rowNumber, deadlineColumnIndex + 1)
          .setValue(taskObject.deadline || "");
      }

      if (subDepColumnIndex !== -1) {
        sheet.getRange(rowNumber, subDepColumnIndex + 1)
          .setValue(taskObject.subDep || "");
      }

      if (linkColumnIndex !== -1) {
        sheet.getRange(rowNumber, linkColumnIndex + 1)
          .setValue(taskObject.link || "");
      }

      if (workGroupColumnIndex !== -1) {
        sheet.getRange(rowNumber, workGroupColumnIndex + 1)
          .setValue(taskObject.workgroup || taskObject.workGroup || "");
      }

      // ===============================
      // ✅ Reporting Schedule Fields
      // กันกรณีไม่มีส่งค่ามา ให้คงค่าเดิมในชีตไว้
      // ===============================
      const oldReportingFrequency =
        reportingFrequencyColumnIndex !== -1
          ? data[i][reportingFrequencyColumnIndex]
          : "";

      const oldReportingMonths =
        reportingMonthsColumnIndex !== -1
          ? data[i][reportingMonthsColumnIndex]
          : "";

      const incomingFrequency = Object.prototype.hasOwnProperty.call(
        taskObject,
        "reportingFrequency"
      )
        ? taskObject.reportingFrequency
        : oldReportingFrequency;

      const incomingMonths = Object.prototype.hasOwnProperty.call(
        taskObject,
        "reportingMonths"
      )
        ? taskObject.reportingMonths
        : oldReportingMonths;

      const reportingFrequency = normalizeReportingFrequencyInput_(
        incomingFrequency
      );

      const reportingMonths = normalizeReportingMonthsInput_(
        incomingMonths,
        reportingFrequency
      );

      if (reportingFrequencyColumnIndex !== -1) {
        sheet.getRange(rowNumber, reportingFrequencyColumnIndex + 1)
          .setValue(reportingFrequency);
      }

      if (reportingMonthsColumnIndex !== -1) {
        sheet.getRange(rowNumber, reportingMonthsColumnIndex + 1)
          .setValue(reportingMonths);
      }

      // ===============================
      // ✅ Progress / Result Input
      // ===============================
      if (baselineColumnIndex !== -1) {
        sheet.getRange(rowNumber, baselineColumnIndex + 1)
          .setValue(valueOrBlank_(taskObject.baseline));
      }

      if (progressPColumnIndex !== -1) {
        sheet.getRange(rowNumber, progressPColumnIndex + 1)
          .setValue(valueOrBlank_(taskObject.progressP));
      }

      if (progressHColumnIndex !== -1) {
        sheet.getRange(rowNumber, progressHColumnIndex + 1)
          .setValue(valueOrBlank_(taskObject.progressH));
      }

      if (progressRColumnIndex !== -1) {
        sheet.getRange(rowNumber, progressRColumnIndex + 1)
          .setValue(valueOrBlank_(taskObject.progressR));
      }

      if (progressColumnIndex !== -1) {
        sheet.getRange(rowNumber, progressColumnIndex + 1)
          .setValue(valueOrBlank_(taskObject.progress));
      }

      if (progressOutcomeColumnIndex !== -1) {
        sheet.getRange(rowNumber, progressOutcomeColumnIndex + 1)
          .setValue(valueOrBlank_(taskObject.progressOutcome));
      }

      if (baselineUnitColumnIndex !== -1) {
        sheet.getRange(rowNumber, baselineUnitColumnIndex + 1)
          .setValue(taskObject.baselineUnit || "");
      }

      if (progressModeColumnIndex !== -1) {
        sheet.getRange(rowNumber, progressModeColumnIndex + 1)
          .setValue(taskObject.progressMode || "");
      }

      if (passOutcomesColumnIndex !== -1) {
        sheet.getRange(rowNumber, passOutcomesColumnIndex + 1)
          .setValue(toCsv(taskObject.passOutcomes));
      }

      if (outcomesColumnIndex !== -1) {
        sheet.getRange(rowNumber, outcomesColumnIndex + 1)
          .setValue(toCsv(taskObject.outcomes));
      }

      // ===============================
      // ✅ Evaluation Rule Fields
      // ===============================
      if (evaluateModeColumnIndex !== -1) {
        sheet.getRange(rowNumber, evaluateModeColumnIndex + 1)
          .setValue(taskObject.evaluateMode || "");
      }

      if (targetOperatorColumnIndex !== -1) {
        sheet.getRange(rowNumber, targetOperatorColumnIndex + 1)
          .setValue(taskObject.targetOperator || "");
      }

      if (targetValueColumnIndex !== -1) {
        sheet.getRange(rowNumber, targetValueColumnIndex + 1)
          .setValue(valueOrBlank_(taskObject.targetValue));
      }

      if (targetTextColumnIndex !== -1) {
        sheet.getRange(rowNumber, targetTextColumnIndex + 1)
          .setValue(taskObject.targetText || "");
      }

      if (levelOrderColumnIndex !== -1) {
        sheet.getRange(rowNumber, levelOrderColumnIndex + 1)
          .setValue(taskObject.levelOrder || "");
      }

      // ===============================
      // ✅ Recalculate / Mark Submitted
      // ===============================
      updateAchievementForRow(sheet, rowNumber);

      if (hasMonthlyInput(taskObject)) {
        markTaskSubmittedForRow(
          sheet,
          rowNumber,
          taskObject.submittedBy || ""
        );
      }

      touchUpdatedAt(sheet, rowNumber);

      return JSON.stringify({
        success: true,
        message: "อัปเดตรายละเอียดงานและผลประเมินสำเร็จแล้ว"
      });
    }

    return JSON.stringify({
      success: false,
      message: "ไม่พบงานที่คุณต้องการอัปเดต."
    });

  } catch (error) {
    console.error("Error updating task details:", error);

    return JSON.stringify({
      success: false,
      message: "เกิดข้อผิดพลาดขณะอัปเดตรายละเอียดงาน: " + error.message
    });
  }
}

/**
 * ตรวจสอบและตั้งค่า Google Sheet ให้พร้อมใช้งาน
 * สร้างชีตและ Header หากยังไม่มี
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  let currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  currentHeaders = currentHeaders.map(h => String(h || '').trim());

  const hasHeader = currentHeaders.some(h => h !== '');

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  // ✅ เพิ่มเฉพาะ header ที่ยังไม่มี ต่อท้ายเท่านั้น
  HEADERS.forEach(header => {
    if (!currentHeaders.includes(header)) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(header);
      sheet.getRange(1, nextCol).setFontWeight('bold');
      currentHeaders.push(header);
    }
  });

  sheet.setFrozenRows(1);
  return sheet;
}

// ✅ ดึง HTML login.html มาแทรกใน dashboard
function getLoginHTML() {
  // ดึงไฟล์ login.html แล้วส่งกลับเป็น string (เพื่อฝังใน dashboard)
  return HtmlService.createHtmlOutputFromFile('login').getContent();
}

// ✅ ตรวจสอบการเข้าสู่ระบบจากชีต login
function loginCheck(username, password) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('login');
    if (!sheet) {
      return { success: false, message: '❌ ไม่พบชีตชื่อ "login"' };
    }

    const data = sheet.getDataRange().getValues();
    data.shift(); // ตัดหัวตารางออก

    // 🔍 วนตรวจข้อมูลผู้ใช้ทั้งหมด
    for (let i = 0; i < data.length; i++) {
      const [id, name, user, pass, role, startDatetime] = data[i];
      const cleanPass = String(pass).trim();

      // ถ้าตรงกับ username และ password
      if (user === username && cleanPass === password) {
        const now = new Date();
        sheet.getRange(i + 2, 6).setValue(now); // บันทึกเวลาเข้าใช้

        return {
          success: true,
          name,
          role: role || 'user',
          loginTime: now.toISOString()
        };
      }
    }

    // ❌ ไม่พบผู้ใช้
    return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };

  } catch (err) {
    return { success: false, message: 'เกิดข้อผิดพลาดในระบบ' };
  }
}

// ✅ ฟังก์ชันสมัครสมาชิกใหม่
function registerUser(name, username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("login");

  if (!name || !username || !password) {
    return { success: false, message: "⚠️ ข้อมูลไม่ครบ" };
  }

  const data = sheet.getDataRange().getValues();
  const usernameExists = data.some(row => row[2] === username);
  if (usernameExists) {
    return { success: false, message: "❌ ชื่อผู้ใช้นี้มีอยู่แล้ว" };
  }

  const newId = sheet.getLastRow();
  const role = "user";
  const now = new Date();

  // บันทึกผู้ใช้ใหม่ในชีต login
  sheet.appendRow([newId, name, username, "'" + String(password), role, now]);

  return { success: true, message: "✅ ลงทะเบียนสำเร็จ" };
}

// ของuser.Poup.html ดึงข้อมูล
function getAllUsers(currentUsername) {
  try {

    requireSuperAdmin_(currentUsername);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('login');
    if (!sheet) return JSON.stringify([]);

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const users = data.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        const key = h.toString().trim().toLowerCase();
        obj[key] = row[i];
      });
      return {
        ID: obj.id,
        name: obj.name,
        username: obj.username || obj.usename,
        role: obj.role,
        startdatetime: obj.startdatetime
      };
    });

    return JSON.stringify(users); // ✅ ส่งออกเป็น string
  } catch (err) {
    Logger.log("❌ Error in getAllUsers: " + err);
    return JSON.stringify({
      error: true,
      message: err.message || "ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้"
    });
  }
}


// ปรับให้รับ currentUsername (ค่าที่มาจาก client)
function updateUserRole(id, newRole, currentUsername) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('login');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).toLowerCase());
    const idCol = headers.indexOf('id');
    const usernameCol = headers.indexOf('username');
    const roleCol = headers.indexOf('role');

    // หาแถว current user และ target user
    let currentUserRow = null;
    let currentUserRole = null;
    let targetRow = null;
    let targetUsername = null;
    let targetRole = null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[usernameCol]) === String(currentUsername)) {
        currentUserRow = i + 1;
        currentUserRole = row[roleCol];
      }
      if (String(row[idCol]) === String(id)) {
        targetRow = i + 1;
        targetUsername = row[usernameCol];
        targetRole = row[roleCol]; // ✅ เพิ่มบรรทัดนี้
      }
    }

    if (!targetRow) return JSON.stringify({ success: false, message: '❌ ไม่พบผู้ใช้ที่ต้องการแก้ไข' });
    if (!currentUserRow) return JSON.stringify({ success: false, message: '⚠️ ไม่พบข้อมูลผู้ใช้งานปัจจุบัน' });

    // ตรวจสิทธิ์: ต้องเป็น admin
    if (String(currentUserRole) !== 'superadmin') {
      return JSON.stringify({ success: false, message: '⚠️ เฉพาะ superadmin เท่านั้นที่สามารถเปลี่ยนสิทธิ์ได้' });
    }

    // ห้ามเปลี่ยน role ของตัวเอง
    if (String(targetUsername) === String(currentUsername)) {
      return JSON.stringify({ success: false, message: '⚠️ ไม่สามารถเปลี่ยนสิทธิ์ของบัญชีตัวเองได้' });
    }

    // ✅ 🔒 ใส่ “ตรงนี้เลย”
    const superAdminCount = data
      .slice(1)
      .filter(r => String(r[roleCol]) === 'superadmin').length;

    if (
      String(targetRole) === 'superadmin' &&
      String(newRole) !== 'superadmin' &&
      superAdminCount <= 1
    ) {
      return JSON.stringify({
        success: false,
        message: '⚠️ ไม่สามารถลดสิทธิ์ superadmin คนสุดท้ายได้'
      });
    }
    // อัปเดต
    sheet.getRange(targetRow, roleCol + 1).setValue(newRole);
    return JSON.stringify({ success: true, message: `✅ เปลี่ยนสิทธิ์ของ ${targetUsername} เป็น ${newRole}` });

  } catch (err) {
    console.error('updateUserRole error:', err);
    return JSON.stringify({ success: false, message: '❌ เกิดข้อผิดพลาดในระบบ' });
  }
}

function deleteUser(id, currentUsername) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('login');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).toLowerCase());
    const idCol = headers.indexOf('id');
    const usernameCol = headers.indexOf('username');
    const roleCol = headers.indexOf('role');

    let targetRow = null;
    let targetUsername = null;
    let targetRole = null;
    let currentUserRole = null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[idCol]) === String(id)) {
        targetRow = i + 1;
        targetUsername = row[usernameCol];
        targetRole = row[roleCol];
      }
      if (String(row[usernameCol]) === String(currentUsername)) {
        currentUserRole = row[roleCol];
      }
    }

    if (!targetRow) {
      return JSON.stringify({ success: false, message: '❌ ไม่พบผู้ใช้ที่ต้องการลบ' });
    }

    // 🔐 เฉพาะ superadmin เท่านั้น
    if (String(currentUserRole) !== 'superadmin') {
      return JSON.stringify({
        success: false,
        message: '⚠️ เฉพาะ superadmin เท่านั้นที่สามารถลบผู้ใช้ได้'
      });
    }

    // ❌ ห้ามลบตัวเอง
    if (String(targetUsername) === String(currentUsername)) {
      return JSON.stringify({
        success: false,
        message: '⚠️ ไม่สามารถลบบัญชีของตัวเองได้'
      });
    }

    // 🔒 ห้ามลบ superadmin คนสุดท้าย
    const superAdminCount = data
      .slice(1)
      .filter(r => String(r[roleCol]) === 'superadmin').length;

    if (String(targetRole) === 'superadmin' && superAdminCount <= 1) {
      return JSON.stringify({
        success: false,
        message: '⚠️ ไม่สามารถลบ superadmin คนสุดท้ายได้'
      });
    }

    // 🔒 ห้ามลบ admin คนสุดท้าย
    const adminCount = data
      .slice(1)
      .filter(r => String(r[roleCol]) === 'admin').length;

    if (String(targetRole) === 'admin' && adminCount <= 1) {
      return JSON.stringify({
        success: false,
        message: '⚠️ ไม่สามารถลบ Admin คนสุดท้ายได้'
      });
    }

    // ✅ ลบจริง
    sheet.deleteRow(targetRow);

    return JSON.stringify({
      success: true,
      message: `🗑️ ลบบัญชี ${targetUsername} เรียบร้อยแล้ว`
    });

  } catch (err) {
    console.error('deleteUser error:', err);
    return JSON.stringify({
      success: false,
      message: '❌ เกิดข้อผิดพลาดในระบบ'
    });
  }
}



function getTasksByMonth(year, month) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return JSON.stringify({ error: "ไม่พบชีต " + SHEET_NAME });
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return JSON.stringify([]);
    }

    const headers = data.shift();
    const timestampIdx = headers.indexOf("Timestamp");

    if (timestampIdx === -1) {
      return JSON.stringify({ error: "ไม่พบคอลัมน์ Timestamp" });
    }

    const y = Number(year);
    const m = Number(month);

    const filtered = data.filter(row => {
      const rawDate = row[timestampIdx];
      if (!rawDate) return false;

      const date = new Date(rawDate);
      if (isNaN(date.getTime())) return false;

      return date.getFullYear() === y && (date.getMonth() + 1) === m;
    });

    const result = filtered.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

    return JSON.stringify(result);

  } catch (err) {
    console.error("getTasksByMonth ERROR:", err);
    return JSON.stringify({
      error: "โหลดข้อมูลรายเดือนไม่สำเร็จ: " + err.message
    });
  }
}


function updateTaskProgressAndStatus(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error("ไม่พบชีต " + SHEET_NAME);
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 2) {
      return JSON.stringify({
        success: false,
        message: "ไม่พบข้อมูลตัวชี้วัดในชีต"
      });
    }

    const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = values[0].map(h => String(h || "").trim());

    const col = name => headers.indexOf(name);

    const idCol = col("ID");
    const progressCol = col("Progress");
    const outcomeCol = col("ProgressOutcome");
    const statusCol = col("Status");
    const challengesCol = col("Challenges");
    const nextStepsCol = col("NextSteps");
    const baselineUnitCol = col("BaselineUnit");
    const evaluateModeCol = col("EvaluateMode");
    const progressModeCol = col("ProgressMode");

    if (idCol === -1) {
      throw new Error("ไม่พบคอลัมน์ ID");
    }

    const targetId = String(data.id || data.ID || "").trim();

    if (!targetId) {
      return JSON.stringify({
        success: false,
        message: "ไม่พบรหัสตัวชี้วัดที่ต้องการอัปเดต"
      });
    }

    function getOld(row, headerName) {
      const c = col(headerName);
      return c !== -1 ? row[c] : "";
    }

    function hasValue(value) {
      return value !== null &&
        value !== undefined &&
        String(value).trim() !== "";
    }

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowId = String(row[idCol] || "").trim();

      if (rowId !== targetId) continue;

      const rowNumber = i + 1;

      const oldEvaluateMode = String(getOld(row, "EvaluateMode") || "").trim();
      const oldProgressMode = String(getOld(row, "ProgressMode") || "").trim();

      let evaluateMode = String(data.evaluateMode || oldEvaluateMode || "").trim();
      let progressMode = String(data.progressMode || oldProgressMode || "").trim();

      if (!progressMode) {
        if (evaluateMode === "percent" || evaluateMode === "number") {
          progressMode = "percent";
        } else if (evaluateMode === "level" || evaluateMode === "passfail") {
          progressMode = "custom";
        }
      }

      if (!evaluateMode) {
        if (progressMode === "percent") {
          evaluateMode = "percent";
        } else if (progressMode === "custom") {
          evaluateMode = oldEvaluateMode || "level";
        }
      }

      const rawProgress =
        data.progress !== undefined
          ? data.progress
          : data.Progress !== undefined
            ? data.Progress
            : "";

      const rawOutcome =
        data.progressOutcome !== undefined && String(data.progressOutcome).trim() !== ""
          ? data.progressOutcome
          : rawProgress;

      const isNumericMode =
        progressMode === "percent" ||
        evaluateMode === "percent" ||
        evaluateMode === "number";

      const isChoiceMode =
        progressMode === "custom" ||
        evaluateMode === "level" ||
        evaluateMode === "passfail";

      // ✅ 1) บันทึกผลลัพธ์รอบนี้
      if (isNumericMode) {
        if (!hasValue(rawProgress)) {
          return JSON.stringify({
            success: false,
            message: "กรุณากรอกผลลัพธ์รอบนี้"
          });
        }

        const num = Number(rawProgress);

        if (Number.isNaN(num)) {
          return JSON.stringify({
            success: false,
            message: "ผลลัพธ์ต้องเป็นตัวเลข"
          });
        }

        if (progressCol !== -1) {
          sheet.getRange(rowNumber, progressCol + 1).setValue(num);
        }

        if (outcomeCol !== -1) {
          sheet.getRange(rowNumber, outcomeCol + 1).setValue("");
        }

        if (progressModeCol !== -1) {
          sheet.getRange(rowNumber, progressModeCol + 1).setValue("percent");
        }

        if (evaluateModeCol !== -1 && evaluateMode) {
          sheet.getRange(rowNumber, evaluateModeCol + 1).setValue(evaluateMode);
        }

        if (baselineUnitCol !== -1 && evaluateMode === "percent") {
          sheet.getRange(rowNumber, baselineUnitCol + 1).setValue("ร้อยละ");
        }
      }

      if (isChoiceMode && !isNumericMode) {
        if (!hasValue(rawOutcome)) {
          return JSON.stringify({
            success: false,
            message: "กรุณาเลือกผลลัพธ์รอบนี้"
          });
        }

        if (progressCol !== -1) {
          sheet.getRange(rowNumber, progressCol + 1).setValue("");
        }

        if (outcomeCol !== -1) {
          sheet.getRange(rowNumber, outcomeCol + 1).setValue(String(rawOutcome).trim());
        }

        if (progressModeCol !== -1) {
          sheet.getRange(rowNumber, progressModeCol + 1).setValue("custom");
        }

        if (evaluateModeCol !== -1 && evaluateMode) {
          sheet.getRange(rowNumber, evaluateModeCol + 1).setValue(evaluateMode);
        }
      }

      // ✅ 2) ข้อมูลประกอบ
      if (statusCol !== -1) {
        sheet.getRange(rowNumber, statusCol + 1)
          .setValue(data.status || getOld(row, "Status") || "Pending");
      }

      if (challengesCol !== -1) {
        sheet.getRange(rowNumber, challengesCol + 1)
          .setValue(data.challenges || "");
      }

      if (nextStepsCol !== -1) {
        sheet.getRange(rowNumber, nextStepsCol + 1)
          .setValue(data.nextSteps || "");
      }

      // ✅ 3) คำนวณผลประเมินใหม่
      updateAchievementForRow(sheet, rowNumber);

      // ✅ 4) Mark ว่าส่งข้อมูลรอบเดือนแล้ว
      markTaskSubmittedForRow(
        sheet,
        rowNumber,
        data.submittedBy || ""
      );

      touchUpdatedAt(sheet, rowNumber);
      SpreadsheetApp.flush();

      return JSON.stringify({
        success: true,
        message: "บันทึกผลรายเดือนเรียบร้อยแล้ว ✅",
        debug: {
          id: targetId,
          rowNumber: rowNumber,
          evaluateMode: evaluateMode,
          progressMode: progressMode,
          progress: rawProgress,
          progressOutcome: rawOutcome
        }
      });
    }

    return JSON.stringify({
      success: false,
      message: "ไม่พบ Task ID: " + targetId
    });

  } catch (err) {
    console.error("updateTaskProgressAndStatus ERROR:", err);

    return JSON.stringify({
      success: false,
      message: "เกิดข้อผิดพลาดขณะบันทึกผลรายเดือน: " + err.message
    });
  }
}


/* Helper: คำนวณรอบ 15 วัน */
// 1. ฟังก์ชันเตรียม Sheet (แก้ให้เลิกสั่ง Clear ข้อมูล)
function setupHistorySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("TaskHistory");

  if (!sheet) {
    sheet = ss.insertSheet("TaskHistory");
    sheet.getRange(1, 1, 1, HISTORY_HEADERS.length).setValues([HISTORY_HEADERS]);
    sheet.getRange(1, 1, 1, HISTORY_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return sheet;
  }

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  let currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  currentHeaders = currentHeaders.map(function(h) {
    return String(h || "").trim();
  });

  const hasHeader = currentHeaders.some(function(h) {
    return h !== "";
  });

  // ✅ ถ้าชีตว่างจริง ๆ ให้ใส่ header ใหม่ทั้งหมด
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, HISTORY_HEADERS.length).setValues([HISTORY_HEADERS]);
    sheet.getRange(1, 1, 1, HISTORY_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return sheet;
  }

  // ✅ เพิ่มเฉพาะ header ที่ยังไม่มี ต่อท้ายเท่านั้น
  // ไม่แทรกกลาง ไม่ลบ ไม่ clear ข้อมูลเก่า
  HISTORY_HEADERS.forEach(function(header) {
    if (!currentHeaders.includes(header)) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(header);
      sheet.getRange(1, nextCol).setFontWeight("bold");
      currentHeaders.push(header);
    }
  });

  sheet.setFrozenRows(1);
  return sheet;
}



// 3. ฟังก์ชันสำหรับตั้งเวลา (Manual Trigger) - ให้ก๊อปไปวางต่อท้ายไฟล์
function manualTriggerWithConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // *** สำคัญ: เช็คชื่อ Sheet ในไฟล์คุณว่าชื่อ "Settings" หรือชื่ออื่น ***
  const configSheet = ss.getSheetByName("Settings"); 
  if (!configSheet) return console.error("ไม่พบหน้า Settings");

  const configData = configSheet.getRange("A2:B5").getValues();
  let isEnabled = false;
  let snapshotDays = "";

  configData.forEach(row => {
    if (row[0] === "enabled") isEnabled = row[1];
    if (row[0] === "snapshot_days") snapshotDays = row[1].toString();
  });

  // เช็คสถานะเปิดใช้งาน (รองรับทั้ง TRUE และ True)
  if (String(isEnabled).toUpperCase() !== "TRUE") return;

  const today = new Date();
  const currentDate = today.getDate().toString();
  // ลบเครื่องหมายคำพูดออกถ้าเผลอพิมพ์ติดมา
  const allowedDays = snapshotDays.replace(/"/g, '').split(",").map(d => d.trim());

  if (allowedDays.includes(currentDate)) {
    snapshotTasks15Days_(true, "SYSTEM_TRIGGER");
  } else {
    console.log("วันนี้วันที่ " + currentDate + " ยังไม่ถึงรอบบันทึกที่ตั้งไว้ (" + snapshotDays + ")");
  }
}


function getPeriodInfo(date) {
  // ✅ ปิด logic รอบ 15 วันเดิม
  // ทุกจุดที่ยังเผลอเรียก getPeriodInfo จะได้ผลเป็น "เดือนก่อนหน้า" แทน
  return getPreviousMonthPeriodInfo(date);
}

function getPreviousMonthPeriodInfo(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  // เดือนก่อนหน้า
  const targetStart = new Date(year, month - 1, 1);
  const targetEnd = new Date(year, month, 0);

  const targetYear = targetStart.getFullYear();
  const targetMonth = targetStart.getMonth();

  const periodKey = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;

  const thaiMonths = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  const periodLabel = `${thaiMonths[targetMonth]} ${targetYear + 543}`;

  return {
    key: periodKey,          // เช่น 2026-05
    label: periodLabel,      // เช่น พ.ค. 2569
    start: targetStart,
    end: targetEnd
  };
}



                  const PERIOD_CONTROL_SHEET = "PeriodControl";

            function setupPeriodControlSheet  () {
              const ss = SpreadsheetApp.getActiveSpreadsheet();
              let sheet = ss.getSheetByName(PERIOD_CONTROL_SHEET);

              if (!sheet) {
                sheet = ss.insertSheet(PERIOD_CONTROL_SHEET);
              }

              const headers = ["Key", "Value", "Description", "UpdatedAt", "UpdatedBy"];

              // ✅ ตั้ง header โดยไม่ล้างข้อมูลเก่า
              const lastCol = Math.max(sheet.getLastColumn(), 1);
              const currentHeaders = sheet
                .getRange(1, 1, 1, Math.max(lastCol, headers.length))
                .getValues()[0]
                .map(h => String(h || "").trim());

              const hasHeader = currentHeaders.some(h => h !== "");

              if (!hasHeader) {
                sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
                sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
                sheet.setFrozenRows(1);
              } else {
                headers.forEach((h, i) => {
                  if (!currentHeaders[i]) {
                    sheet.getRange(1, i + 1).setValue(h);
                    sheet.getRange(1, i + 1).setFontWeight("bold");
                  }
                });
                sheet.setFrozenRows(1);
              }

              const now = new Date();

              // ✅ ค่าเริ่มต้น: ใช้เดือนก่อนหน้าตาม logic เดิมก่อน
              // เพื่อไม่ให้ระบบเปลี่ยนพฤติกรรมทันที
              const defaultActive = getPreviousMonthPeriodInfo(now);

              const map = getPeriodControlMap_();

              const defaults = [
                [
                  "ActivePeriodKey",
                  defaultActive.key,
                  "รหัสรอบรายงานที่กำลังเปิดให้กรอก เช่น 2026-05"
                ],
                [
                  "ActivePeriodLabel",
                  defaultActive.label,
                  "ชื่อรอบรายงานที่กำลังเปิดให้กรอก เช่น พ.ค. 2569"
                ],
                [
                  "ActivePeriodStart",
                  defaultActive.start,
                  "วันเริ่มต้นของรอบรายงานที่เปิดอยู่"
                ],
                [
                  "ActivePeriodEnd",
                  defaultActive.end,
                  "วันสิ้นสุดของรอบรายงานที่เปิดอยู่"
                ],
                [
                  "LastClosedPeriodKey",
                  "",
                  "รหัสรอบรายงานล่าสุดที่ปิดรอบแล้ว"
                ],
                [
                  "LastClosedPeriodLabel",
                  "",
                  "ชื่อรอบรายงานล่าสุดที่ปิดรอบแล้ว"
                ],
                [
                  "LastClosedAt",
                  "",
                  "วันเวลาที่ปิดรอบล่าสุด"
                ],
                [
                  "LastClosedBy",
                  "",
                  "ผู้ที่ปิดรอบล่าสุด"
                ]
              ];

              defaults.forEach(item => {
                const key = item[0];
                const value = item[1];
                const desc = item[2];

                if (!map[key]) {
                  sheet.appendRow([key, value, desc, now, "SYSTEM"]);
                }
              });

              sheet.autoResizeColumns(1, 5);

              return "✅ setup PeriodControl สำเร็จ";
            }


            function getPeriodControlMap_() {
              const ss = SpreadsheetApp.getActiveSpreadsheet();
              const sheet = ss.getSheetByName(PERIOD_CONTROL_SHEET);

              if (!sheet) {
                return {};
              }

              const lastRow = sheet.getLastRow();
              const lastCol = sheet.getLastColumn();

              if (lastRow < 2) {
                return {};
              }

              const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
                .map(h => String(h || "").trim());

              const keyCol = headers.indexOf("Key");
              const valueCol = headers.indexOf("Value");
              const descCol = headers.indexOf("Description");
              const updatedAtCol = headers.indexOf("UpdatedAt");
              const updatedByCol = headers.indexOf("UpdatedBy");

              if (keyCol === -1 || valueCol === -1) {
                throw new Error("PeriodControl ต้องมีคอลัมน์ Key และ Value");
              }

              const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
              const map = {};

              values.forEach((row, idx) => {
                const key = String(row[keyCol] || "").trim();
                if (!key) return;

                map[key] = {
                  rowIndex: idx + 2,
                  value: row[valueCol],
                  description: descCol !== -1 ? row[descCol] : "",
                  updatedAt: updatedAtCol !== -1 ? row[updatedAtCol] : "",
                  updatedBy: updatedByCol !== -1 ? row[updatedByCol] : ""
                };
              });

              return map;
            }


            function getPeriodControlValue_(map, key) {
              return map[key] ? map[key].value : "";
            }


            function updatePeriodControlValue_(key, value, description, updatedBy) {
              const ss = SpreadsheetApp.getActiveSpreadsheet();
              const sheet = ss.getSheetByName(PERIOD_CONTROL_SHEET) || setupPeriodControlSheet();

              const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PERIOD_CONTROL_SHEET);
              const map = getPeriodControlMap_();
              const now = new Date();

              const shouldStoreAsText =
                key === "ActivePeriodKey" ||
                key === "LastClosedPeriodKey";

              if (map[key]) {
                const rowIndex = map[key].rowIndex;
                const valueCell = sh.getRange(rowIndex, 2);

                if (shouldStoreAsText) {
                  valueCell.setNumberFormat("@").setValue(String(value || ""));
                } else {
                  valueCell.setValue(value);
                }

                if (description !== undefined) sh.getRange(rowIndex, 3).setValue(description);
                sh.getRange(rowIndex, 4).setValue(now);
                sh.getRange(rowIndex, 5).setValue(updatedBy || "SYSTEM");

              } else {
                sh.appendRow([
                  key,
                  shouldStoreAsText ? String(value || "") : value,
                  description || "",
                  now,
                  updatedBy || "SYSTEM"
                ]);

                if (shouldStoreAsText) {
                  const newRow = sh.getLastRow();
                  sh.getRange(newRow, 2).setNumberFormat("@");
                }
              }
            }


            function getActivePeriodInfo() {
              setupPeriodControlSheet();

              const map = getPeriodControlMap_();

              let key = String(getPeriodControlValue_(map, "ActivePeriodKey") || "").trim();
              let label = String(getPeriodControlValue_(map, "ActivePeriodLabel") || "").trim();

              const startRaw = getPeriodControlValue_(map, "ActivePeriodStart");
              const endRaw = getPeriodControlValue_(map, "ActivePeriodEnd");

              const start = startRaw ? new Date(startRaw) : null;
              const end = endRaw ? new Date(endRaw) : null;

              const isValidStart = start && !isNaN(start.getTime());
              const isValidEnd = end && !isNaN(end.getTime());

              const thaiMonths = [
                "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
              ];

              // ✅ ถ้า key ไม่ใช่รูปแบบ 2026-06 ให้สร้างใหม่จาก ActivePeriodStart
              if (!/^\d{4}-\d{2}$/.test(key)) {
                if (isValidStart) {
                  key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

                  updatePeriodControlValue_(
                    "ActivePeriodKey",
                    key,
                    "รหัสรอบรายงานที่กำลังเปิดให้กรอก เช่น 2026-06",
                    "SYSTEM_REPAIR"
                  );
                } else {
                  const fallback = getPreviousMonthPeriodInfo(new Date());
                  return fallback;
                }
              }

              // ✅ ถ้า label ว่าง ให้สร้างจาก ActivePeriodStart
              if (!label && isValidStart) {
                label = `${thaiMonths[start.getMonth()]} ${start.getFullYear() + 543}`;

                updatePeriodControlValue_(
                  "ActivePeriodLabel",
                  label,
                  "ชื่อรอบรายงานที่กำลังเปิดให้กรอก เช่น มิ.ย. 2569",
                  "SYSTEM_REPAIR"
                );
              }

              return {
                key: key,
                label: label,
                start: isValidStart ? start : "",
                end: isValidEnd ? end : ""
              };
            }


            function getNextMonthPeriodInfo_(periodInfo) {
              const thaiMonths = [
                "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
              ];

              let year;
              let monthIndex;

              // ✅ ใช้ periodInfo.key เป็นหลัก เช่น 2026-05
              const key = String(periodInfo && periodInfo.key ? periodInfo.key : "").trim();
              const match = key.match(/^(\d{4})-(\d{2})$/);

              if (match) {
                year = Number(match[1]);
                monthIndex = Number(match[2]) - 1;
              } else if (periodInfo && periodInfo.start) {
                const d = new Date(periodInfo.start);
                if (isNaN(d.getTime())) {
                  throw new Error("ActivePeriodStart ไม่ถูกต้อง");
                }
                year = d.getFullYear();
                monthIndex = d.getMonth();
              } else {
                throw new Error("ไม่พบข้อมูลรอบรายงานปัจจุบัน");
              }

              // ✅ เดือนถัดไป
              const nextStart = new Date(year, monthIndex + 1, 1);
              const nextEnd = new Date(year, monthIndex + 2, 0);

              const nextYear = nextStart.getFullYear();
              const nextMonthIndex = nextStart.getMonth();

              return {
                key: `${nextYear}-${String(nextMonthIndex + 1).padStart(2, "0")}`,
                label: `${thaiMonths[nextMonthIndex]} ${nextYear + 543}`,
                start: nextStart,
                end: nextEnd
              };
            }


            function setActivePeriodInfo_(periodInfo, updatedBy) {
              updatePeriodControlValue_(
                "ActivePeriodKey",
                periodInfo.key,
                "รหัสรอบรายงานที่กำลังเปิดให้กรอก เช่น 2026-05",
                updatedBy
              );

              updatePeriodControlValue_(
                "ActivePeriodLabel",
                periodInfo.label,
                "ชื่อรอบรายงานที่กำลังเปิดให้กรอก เช่น พ.ค. 2569",
                updatedBy
              );

              updatePeriodControlValue_(
                "ActivePeriodStart",
                periodInfo.start,
                "วันเริ่มต้นของรอบรายงานที่เปิดอยู่",
                updatedBy
              );

              updatePeriodControlValue_(
                "ActivePeriodEnd",
                periodInfo.end,
                "วันสิ้นสุดของรอบรายงานที่เปิดอยู่",
                updatedBy
              );
            }


            function testPeriodControl() {
              setupPeriodControlSheet();

              const active = getActivePeriodInfo();
              const next = getNextMonthPeriodInfo_(active);

              Logger.log("ActivePeriod:");
              Logger.log(JSON.stringify(active, null, 2));

              Logger.log("NextPeriod:");
              Logger.log(JSON.stringify(next, null, 2));

              return "✅ ทดสอบ PeriodControl สำเร็จ";
            }


      /* ฟังก์ชัน Snapshot หลัก */

      function normalizeDQText_(value) {
        return String(value === null || value === undefined ? "" : value).trim();
      }


      // ✅ alias กันชื่อเรียกไม่ตรง
      function normalizeDQText(value) {
        return normalizeDQText_(value);
      }

      function normalizedDQText(value) {
        return normalizeDQText_(value);
      }


      function isDQBlank_(value) {
        return normalizeDQText_(value) === "";
      }

      function isDQNumber_(value) {
        if (isDQBlank_(value)) return false;
        return !isNaN(Number(value));
      }

      function getTaskDataRowsForDQ_() {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName("TaskData");

        if (!sheet) {
          throw new Error("ไม่พบชีต TaskData");
        }

        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();

        if (lastRow < 2) {
          return [];
        }

        const headers = sheet
          .getRange(1, 1, 1, lastCol)
          .getValues()[0]
          .map(function(h) {
            return String(h || "").trim();
          });

        const values = sheet
          .getRange(2, 1, lastRow - 1, lastCol)
          .getValues();

        return values.map(function(row, index) {
          const obj = {
            _rowNumber: index + 2
          };

          headers.forEach(function(header, colIndex) {
            obj[header] = row[colIndex];
          });

          return obj;
        });
      }

      function addDQIssue_(issues, level, row, field, message) {
        issues.push({
          level: level,
          rowNumber: row && row._rowNumber ? row._rowNumber : "",
          taskId: normalizeDQText(row && row.ID),
          taskName: normalizeDQText(row && row.Task),
          field: field || "",
          message: message || ""
        });
      }

      function validateTaskRowForCloseDQ_(row, issues, period) {
        row = row || {};
        period = period || getActivePeriodInfo();

        const taskName = normalizeDQText(row.Task);
        const taskId = normalizeDQText(row.ID);
        const mode = normalizeDQText(row.EvaluateMode).toLowerCase();

        const rawInputStatus = normalizeDQText(row.InputStatus);
        const achievementStatus = normalizeDQText(row.AchievementStatus);

        const department = normalizeDQText(row.Department);
        const workGroup = normalizeDQText(row.WorkGroup);
        const assignee = normalizeDQText(row.Assignee);
        const targetText = normalizeDQText(row.TargetText);
        const resultText = normalizeDQText(row.ResultText);

const inputPeriodKey = normalizePeriodKeyServer_(row.InputPeriodKey);
        const inputPeriodLabel = normalizeDQText(row.InputPeriodLabel);
        const submittedAt = normalizeDQText(row.SubmittedAt);
        const submittedBy = normalizeDQText(row.SubmittedBy);
        const rawReportingFrequency = normalizeDQText(row.ReportingFrequency);

        const reportingFrequency = normalizeReportingFrequencyForSnapshot_(row.ReportingFrequency);
        const reportingMonths = parseReportingMonthsForSnapshot_(row.ReportingMonths);

        const isDueThisPeriod = isTaskDueInSnapshotPeriod_(row, period);
        const isSubmittedInPeriod = isTaskSubmittedInSnapshotPeriod_(row, period);
        const reportingStatus = getReportingStatusForSnapshot_(row, period);

        const shouldValidateSubmittedResult =
          isSubmittedInPeriod &&
          reportingStatus !== "NotDue";

        // =========================
        // ✅ Snapshot Schedule Quality
        // =========================
        if (reportingFrequency === "Custom" && reportingMonths.length === 0) {
          addDQIssue_(
            issues,
            "critical",
            row,
            "ReportingMonths",
            "ตัวชี้วัดแบบ Custom ต้องเลือกเดือนที่ต้องรายงานอย่างน้อย 1 เดือน"
          );
        }

        if (rawInputStatus === "Submitted" && !isSubmittedInPeriod) {
          addDQIssue_(
            issues,
            "critical",
            row,
            "InputPeriodKey",
            "InputStatus เป็น Submitted แต่ InputPeriodKey/InputPeriodLabel ไม่ตรงกับรอบที่กำลังปิด: " + period.label
          );
        }

        if (
          rawInputStatus === "Submitted" &&
          isSubmittedInPeriod &&
          !isDueThisPeriod &&
          reportingFrequency !== "AdHoc"
        ) {
          addDQIssue_(
            issues,
            "warning",
            row,
            "ReportingFrequency",
            "มีการส่งข้อมูลในเดือนที่ยังไม่ถึงรอบรายงาน ระบบจะ Snapshot เป็น NotDue และไม่นับเป็นค้างส่ง"
          );
        }

        // =========================
        // ✅ Metadata / UX Quality
        // =========================
        if (!department) {
          addDQIssue_(
            issues,
            "warning",
            row,
            "Department",
            "ยังไม่ได้ระบุหมวดหมู่ตัวชี้วัด ทำให้ filter/รายงานผู้บริหารไม่ชัดเจน"
          );
        }

        if (!workGroup) {
          addDQIssue_(
            issues,
            "warning",
            row,
            "WorkGroup",
            "ยังไม่ได้ระบุกลุ่มงาน ทำให้สรุปกลุ่มงานที่ต้องติดตามไม่ครบ"
          );
        }

        if (!assignee || assignee === "-") {
          addDQIssue_(
            issues,
            "warning",
            row,
            "Assignee",
            "ยังไม่ได้ระบุผู้รับผิดชอบ ทำให้ติดตามเจ้าของตัวชี้วัดไม่ได้"
          );
        }

        if (mode && !targetText) {
          addDQIssue_(
            issues,
            "warning",
            row,
            "TargetText",
            "มีรูปแบบการประเมินแล้ว แต่ยังไม่มีข้อความเป้าหมายสำหรับแสดงใน Dashboard"
          );
        }

        // =========================
        // ✅ Monthly Submission Quality
        // ตรวจเฉพาะรายการที่ส่งใน ActivePeriod จริง
        // =========================
        if (shouldValidateSubmittedResult) {
          if (!inputPeriodKey) {
            addDQIssue_(
              issues,
              "critical",
              row,
              "InputPeriodKey",
              "ส่งข้อมูลแล้ว แต่ไม่มีรหัสรอบรายงาน เช่น 2026-05"
            );
          }

          if (inputPeriodKey && inputPeriodKey !== String(period.key || "").trim()) {
            addDQIssue_(
              issues,
              "critical",
              row,
              "InputPeriodKey",
              "รหัสรอบรายงานของข้อมูลที่ส่ง ไม่ตรงกับรอบที่กำลังปิด: " + period.key
            );
          }

          if (!inputPeriodLabel) {
            addDQIssue_(
              issues,
              "critical",
              row,
              "InputPeriodLabel",
              "ส่งข้อมูลแล้ว แต่ไม่มีชื่อรอบรายงาน เช่น พ.ค. 2569"
            );
          }

          if (!submittedAt) {
            addDQIssue_(
              issues,
              "warning",
              row,
              "SubmittedAt",
              "ส่งข้อมูลแล้ว แต่ไม่มีวันเวลาที่ส่งข้อมูล"
            );
          }

          if (!submittedBy) {
            addDQIssue_(
              issues,
              "warning",
              row,
              "SubmittedBy",
              "ส่งข้อมูลแล้ว แต่ไม่มีชื่อผู้ส่งข้อมูล"
            );
          }

          if (!resultText || resultText === "-") {
            addDQIssue_(
              issues,
              "warning",
              row,
              "ResultText",
              "ส่งข้อมูลแล้ว แต่ข้อความผลลัพธ์ยังว่างหรือเป็น '-' ควรตรวจการคำนวณ ResultText"
            );
          }
        }

        // =========================
        // ✅ Basic Required Fields
        // =========================
        if (!taskId) {
          addDQIssue_(issues, "critical", row, "ID", "ไม่มีรหัสตัวชี้วัด");
        }

        if (!taskName) {
          addDQIssue_(issues, "critical", row, "Task", "ไม่มีชื่อตัวชี้วัด");
        }

if (!mode) {
          addDQIssue_(issues, "warning", row, "EvaluateMode", "ยังไม่ได้กำหนดรูปแบบการประเมิน");
        }

        if (!rawReportingFrequency) {
          addDQIssue_(
            issues,
            "warning",
            row,
            "ReportingFrequency",
            "ยังไม่ได้กำหนดรอบรายงาน ระบบจะตีความเป็น Monthly ชั่วคราว ควรตั้งค่าให้ชัดเจนก่อนปิดรอบ"
          );
        }

        // =========================
        // ✅ Percent / Number Rule Quality
        // =========================
        if (mode === "percent" || mode === "number") {
          const op = normalizeDQText(row.TargetOperator);
          const targetValue = row.TargetValue;

          if (!op) {
            addDQIssue_(
              issues,
              "critical",
              row,
              "TargetOperator",
              "ตัวชี้วัดแบบตัวเลขยังไม่มีเครื่องหมายเปรียบเทียบ เช่น >= หรือ <="
            );
          }

          if (!isDQNumber_(targetValue)) {
            addDQIssue_(
              issues,
              "critical",
              row,
              "TargetValue",
              "ตัวชี้วัดแบบตัวเลขต้องมีค่าเป้าหมายเป็นตัวเลข"
            );
          }

          if (shouldValidateSubmittedResult) {
            const resultValue = row.ResultValue;

            if (!isDQNumber_(resultValue)) {
              addDQIssue_(
                issues,
                "critical",
                row,
                "ResultValue",
                "ส่งข้อมูลแล้ว แต่ไม่มีผลลัพธ์ตัวเลข"
              );
            }
          }
        }

        // =========================
        // ✅ Level Rule Quality
        // =========================
        if (mode === "level") {
          const levelOrder = normalizeDQText(row.LevelOrder);
          const targetLevelText = normalizeDQText(row.TargetLevelText);
          const targetLevelRank = row.TargetLevelRank;

          if (!levelOrder) {
            addDQIssue_(
              issues,
              "critical",
              row,
              "LevelOrder",
              "ตัวชี้วัดแบบระดับต้องมี LevelOrder"
            );
          }

          if (!targetLevelText || !isDQNumber_(targetLevelRank)) {
            addDQIssue_(
              issues,
              "critical",
              row,
              "TargetLevelText/TargetLevelRank",
              "ตัวชี้วัดแบบระดับต้องมีระดับเป้าหมาย"
            );
          }

          if (shouldValidateSubmittedResult) {
            const resultLevelText = normalizeDQText(row.ResultLevelText || row.ResultText);
            const resultLevelRank = row.ResultLevelRank;

            if (!resultLevelText || !isDQNumber_(resultLevelRank)) {
              addDQIssue_(
                issues,
                "critical",
                row,
                "ResultLevelText/ResultLevelRank",
                "ส่งข้อมูลแล้ว แต่ไม่มีผลระดับที่ประเมินได้"
              );
            }
          }
        }

        // =========================
        // ✅ Pass / Fail Rule Quality
        // =========================
        if (mode === "passfail") {
          const passOutcomes = normalizeDQText(row.PassOutcomes || row.TargetValue);

          if (!passOutcomes) {
            addDQIssue_(
              issues,
              "critical",
              row,
              "PassOutcomes",
              "ตัวชี้วัดแบบผ่าน/ไม่ผ่านต้องกำหนดผลลัพธ์ที่ถือว่าผ่าน"
            );
          }

          if (shouldValidateSubmittedResult) {
            const passFailResult = normalizeDQText(
              row.ProgressOutcome || row.ResultText || row.ResultValue
            );

            if (!passFailResult || passFailResult === "-") {
              addDQIssue_(
                issues,
                "critical",
                row,
                "ProgressOutcome/ResultText",
                "ส่งข้อมูลแล้ว แต่ไม่มีผลลัพธ์ผ่าน/ไม่ผ่าน"
              );
            }
          }
        }

        // =========================
        // ✅ Achievement Quality
        // =========================
        if (shouldValidateSubmittedResult && (!achievementStatus || achievementStatus === "NoData")) {
          addDQIssue_(
            issues,
            "critical",
            row,
            "AchievementStatus",
            "ส่งข้อมูลแล้ว แต่สถานะผลประเมินยังเป็น NoData"
          );
        }

        if (shouldValidateSubmittedResult && achievementStatus === "NotEvaluable") {
          addDQIssue_(
            issues,
            "warning",
            row,
            "AchievementStatus",
            "ส่งข้อมูลแล้ว แต่ยังประเมินไม่ได้ ควรตรวจสอบเงื่อนไข"
          );
        }
      }




      function validateDataQualityBeforeClosePeriod_() {
        const rows = getTaskDataRowsForDQ_();
        const period = getActivePeriodInfo();
        const issues = [];

        const seenIds = {};

        const summary = {
          total: rows.length,
          due: 0,
          notDue: 0,
          submitted: 0,
          notSubmitted: 0,
          notEvaluable: 0
        };

        rows.forEach(function(row) {
          const id = normalizeDQText_(row.ID);

          if (id) {
            if (seenIds[id]) {
              addDQIssue_(
                issues,
                "critical",
                row,
                "ID",
                "พบ Task ID ซ้ำกับแถว " + seenIds[id]
              );
            } else {
              seenIds[id] = row._rowNumber;
            }
          }

          const snap = buildSnapshotComputedFields_(row, period);

          if (snap.isDueThisPeriod) {
            summary.due++;
          } else {
            summary.notDue++;
          }

          if (snap.reportingStatus === "Submitted") {
            summary.submitted++;
          } else if (snap.reportingStatus === "NotSubmitted") {
            summary.notSubmitted++;
          } else if (snap.reportingStatus === "NotEvaluable") {
            summary.notEvaluable++;
          }

          validateTaskRowForCloseDQ_(row, issues, period);
        });

        const criticalIssues = issues.filter(function(i) {
          return i.level === "critical";
        });

        const warningIssues = issues.filter(function(i) {
          return i.level === "warning";
        });

        const orderedIssues = criticalIssues.concat(warningIssues);

        return {
          success: criticalIssues.length === 0,
          periodKey: period.key,
          periodLabel: period.label,
          totalRows: rows.length,

          summary: summary,

          criticalCount: criticalIssues.length,
          warningCount: warningIssues.length,

          issues: orderedIssues.slice(0, 50),
          criticalIssues: criticalIssues.slice(0, 20),
          warningIssues: warningIssues.slice(0, 20)
        };
      }


      function testDataQualityCriticalOnly() {
      const result = validateDataQualityBeforeClosePeriod_();

      Logger.log("success: " + result.success);
      Logger.log("totalRows: " + result.totalRows);
      Logger.log("criticalCount: " + result.criticalCount);
      Logger.log("warningCount: " + result.warningCount);

      Logger.log("===== CRITICAL ISSUES =====");

      if (!result.criticalIssues || !result.criticalIssues.length) {
        Logger.log("ไม่มี critical issue");
        return result;
      }

      result.criticalIssues.forEach(function(issue, index) {
        Logger.log(
          (index + 1) +
          ". แถว " + issue.rowNumber +
          " | " + issue.taskName +
          " | " + issue.field +
          " | " + issue.message
        );
      });

      return result;
    }

      function formatDQIssueList_(issues) {
        issues = Array.isArray(issues) ? issues : [];

        if (!issues.length) {
          return "-";
        }

        return issues.map(function(issue, index) {
          const name = issue.taskName || issue.taskId || "ไม่ระบุชื่อ";
          return (
            (index + 1) + ". แถว " + issue.rowNumber +
            " | " + name +
            " | " + issue.field +
            " | " + issue.message
          );
        }).join("\n");
      }

      // ✅ ใช้สำหรับกด Run ทดสอบใน Apps Script ได้โดยตรง
      function testDataQualityBeforeClosePeriod() {
        const result = validateDataQualityBeforeClosePeriod_();

        Logger.log(JSON.stringify(result, null, 2));

        return result;
      }





      function normalizeReportingFrequencyForSnapshot_(value) {
        const text = String(value || "").trim().toLowerCase();

        if (!text) return "Monthly";

        if (["monthly", "month", "รายเดือน"].includes(text)) {
          return "Monthly";
        }

        if (["quarterly", "quarter", "รายไตรมาส", "ไตรมาส"].includes(text)) {
          return "Quarterly";
        }

        if (["semiannual", "semi-annual", "halfyear", "half-year", "รายครึ่งปี", "ครึ่งปี"].includes(text)) {
          return "SemiAnnual";
        }

        if (["annual", "yearly", "รายปี", "ปี"].includes(text)) {
          return "Annual";
        }

        if (["custom", "กำหนดเอง", "เฉพาะเดือน"].includes(text)) {
          return "Custom";
        }

        if (["adhoc", "ad hoc", "ตามรอบงาน", "เมื่อมีข้อมูล"].includes(text)) {
          return "AdHoc";
        }

        // ✅ ถ้าเจอค่าที่ไม่รู้จัก ให้ถือเป็นรายเดือนชั่วคราวก่อน
        return "Monthly";
      }


      function getMonthNumberFromPeriod_(period) {
        const key = String(period && period.key ? period.key : "").trim();
        const match = key.match(/^\d{4}-(\d{2})$/);

        if (match) {
          return Number(match[1]);
        }

        if (period && period.start) {
          const d = new Date(period.start);
          if (!isNaN(d.getTime())) {
            return d.getMonth() + 1;
          }
        }

        return new Date().getMonth() + 1;
      }


      function parseReportingMonthsForSnapshot_(value) {
        const text = String(value || "").trim();

        if (!text) return [];

        return text
          .split(/[,;|\s]+/)
          .map(function(v) {
            return Number(String(v || "").trim());
          })
          .filter(function(n) {
            return Number.isFinite(n) && n >= 1 && n <= 12;
          });
      }


      function isTaskSubmittedInSnapshotPeriod_(task, period) {
        task = task || {};
        period = period || {};

        const inputStatus = String(task.InputStatus || "").trim();

        if (inputStatus !== "Submitted") {
          return false;
        }

        const inputPeriodKey = normalizePeriodKeyServer_(task.InputPeriodKey);
        const inputPeriodLabel = String(task.InputPeriodLabel || "").trim();

        if (inputPeriodKey) {
          return inputPeriodKey === String(period.key || "").trim();
        }

        if (inputPeriodLabel) {
          return inputPeriodLabel === String(period.label || "").trim();
        }

        // ✅ ถ้าส่งแล้วแต่ไม่มี period key/label ให้ไม่ถือว่าส่งในรอบนี้
        // เพราะ Data Quality Check ควรจับเป็น critical ก่อนปิดรอบ
        return false;
      }


      function isTaskDueInSnapshotPeriod_(task, period) {
        task = task || {};
        period = period || {};

        const frequency = normalizeReportingFrequencyForSnapshot_(task.ReportingFrequency);
        const monthNumber = getMonthNumberFromPeriod_(period);
        const reportingMonths = parseReportingMonthsForSnapshot_(task.ReportingMonths);

        if (frequency === "Monthly") {
          return true;
        }

        if (frequency === "Quarterly") {
          return [3, 6, 9, 12].indexOf(monthNumber) !== -1;
        }

        if (frequency === "SemiAnnual") {
          return [3, 9].indexOf(monthNumber) !== -1;
        }

        if (frequency === "Annual") {
          return monthNumber === 9;
        }

        if (frequency === "Custom") {
          return reportingMonths.indexOf(monthNumber) !== -1;
        }

        if (frequency === "AdHoc") {
          // ✅ AdHoc ไม่ถือเป็นงานค้าง ยกเว้นมีการส่งข้อมูลในรอบนั้น
          return isTaskSubmittedInSnapshotPeriod_(task, period);
        }

        return true;
      }


      function getReportingStatusForSnapshot_(task, period) {
        const isDue = isTaskDueInSnapshotPeriod_(task, period);

        if (!isDue) {
          return "NotDue";
        }

        const submitted = isTaskSubmittedInSnapshotPeriod_(task, period);

        if (!submitted) {
          return "NotSubmitted";
        }

        const achievementStatus = String(task.AchievementStatus || "").trim();

        if (
          !achievementStatus ||
          achievementStatus === "NoData" ||
          achievementStatus === "NotEvaluable"
        ) {
          return "NotEvaluable";
        }

        return "Submitted";
      }



      function buildSnapshotComputedFields_(task, period) {
        task = task || {};
        period = period || {};

        const isDueThisPeriod = isTaskDueInSnapshotPeriod_(task, period);
        const isSubmittedInPeriod = isTaskSubmittedInSnapshotPeriod_(task, period);
        const reportingStatus = getReportingStatusForSnapshot_(task, period);

        // ✅ InputStatus ใน TaskHistory ต้องสะท้อนสถานะของรอบ Snapshot
        // ไม่ใช่ค่า raw ใน TaskData ที่อาจค้างจากรอบเก่า
        let inputStatusForHistory = "NotSubmitted";

        if (reportingStatus === "NotDue") {
          inputStatusForHistory = "NotDue";
        } else if (isSubmittedInPeriod) {
          inputStatusForHistory = "Submitted";
        } else {
          inputStatusForHistory = "NotSubmitted";
        }

        const canCarryResult =
          isSubmittedInPeriod &&
          reportingStatus !== "NotDue";

        const inputPeriodKeyForHistory = canCarryResult
          ? (normalizePeriodKeyServer_(task.InputPeriodKey) || String(period.key || ""))
          : String(period.key || "");

        const inputPeriodLabelForHistory = canCarryResult
          ? (String(task.InputPeriodLabel || "").trim() || String(period.label || ""))
          : String(period.label || "");

        const submittedAtForHistory = canCarryResult
          ? (task.SubmittedAt || "")
          : "";

        const submittedByForHistory = canCarryResult
          ? (task.SubmittedBy || "")
          : "";

        let achievementStatusForHistory = "NoData";
        let achievementTextForHistory = "ยังไม่มีข้อมูล";

        if (reportingStatus === "NotDue") {
          achievementStatusForHistory = "NotDue";
          achievementTextForHistory = "ยังไม่ประเมิน เพราะยังไม่ถึงรอบรายงาน";
        } else if (reportingStatus === "NotSubmitted") {
          achievementStatusForHistory = "NoData";
          achievementTextForHistory = "ยังไม่ประเมิน เพราะถึงรอบแล้วแต่ยังไม่ส่งข้อมูล";
        } else if (reportingStatus === "NotEvaluable") {
          achievementStatusForHistory = "NotEvaluable";
          achievementTextForHistory = task.AchievementText || "ส่งข้อมูลแล้ว แต่ยังประเมินไม่ได้";
        } else {
          achievementStatusForHistory = task.AchievementStatus || "NoData";
          achievementTextForHistory = task.AchievementText || "";
        }

        return {
          isDueThisPeriod: isDueThisPeriod,
          isSubmittedInPeriod: isSubmittedInPeriod,
          reportingStatus: reportingStatus,
          inputStatusForHistory: inputStatusForHistory,
          inputPeriodKeyForHistory: inputPeriodKeyForHistory,
          inputPeriodLabelForHistory: inputPeriodLabelForHistory,
          submittedAtForHistory: submittedAtForHistory,
          submittedByForHistory: submittedByForHistory,
          canCarryResult: canCarryResult,
          achievementStatusForHistory: achievementStatusForHistory,
          achievementTextForHistory: achievementTextForHistory
        };
      }


      function snapshotTasks15Days_(force = false, snapshotBy = "SYSTEM") {
          let fileCreated = false;
          let telegramSent = false;

          const now = new Date();
          const day = now.getDate();
          const hour = now.getHours();
          const minute = now.getMinutes();

          const config = getSystemConfig();

          // ⛔ ถ้าไม่ force และ auto ปิด → ออก
          if (!force && config.enabled === false) {
            return "⏸️ Auto Snapshot ปิดอยู่";
          }

          // 📅 เช็กวัน เฉพาะ auto
          const days = String(config.snapshot_days || "")
            .split(",")
            .map(d => Number(String(d).trim()))
            .filter(Boolean);

          if (!force && !days.includes(day)) {
            console.log("⏭️ วันนี้ไม่ใช่วัน Snapshot");
            return "⏭️ วันนี้ไม่ใช่วัน Snapshot";
          }

          // ⏰ เช็กเวลา เฉพาะ auto
          const cfgHour = Number(config.snapshot_hour);
          const cfgMinute = Number(config.snapshot_minute);

          if (!force && (hour !== cfgHour || minute !== cfgMinute)) {
            return "⏳ ยังไม่ถึงเวลาที่ตั้งไว้";
          }

          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const taskSheet = ss.getSheetByName(SHEET_NAME);
          const historySheet = setupHistorySheet();

          if (!taskSheet || !historySheet) {
            throw new Error("ไม่พบ TaskData หรือ TaskHistory");
          }

          const period = getActivePeriodInfo();
          const snapshotRunId = "SNAP-" + Utilities.getUuid();

          // ===============================
          // ✅ อ่าน TaskData
          // ===============================
          const taskData = taskSheet.getDataRange().getValues();
          const taskHeaders = taskData.shift();

          if (taskData.length === 0) {
            return {
              success: true,
              total: 0,
              period: period.label,
              fileCreated: false,
              telegramSent: false
            };
          }

          // ===============================
          // ✅ อ่าน TaskHistory headers จริงจากชีต
          // เพื่อให้เขียนตรงคอลัมน์ใหม่ทั้งหมด
          // ===============================
          const historyLastCol = historySheet.getLastColumn();
          const historyHeaders = historySheet
            .getRange(1, 1, 1, historyLastCol)
            .getValues()[0]
            .map(h => String(h || "").trim());

          const historyValues = historySheet.getLastRow() > 1
            ? historySheet.getRange(2, 1, historySheet.getLastRow() - 1, historyLastCol).getValues()
            : [];

          const historyTaskIdIndex = historyHeaders.indexOf("TaskID");
          const historyPeriodLabelIndex = historyHeaders.indexOf("PeriodLabel");

          // 🔒 กันบันทึกซ้ำในงวดเดียวกัน
          const alreadySnapshotted = new Set();

          if (historyTaskIdIndex !== -1 && historyPeriodLabelIndex !== -1) {
            historyValues.forEach(r => {
              const taskId = String(r[historyTaskIdIndex] || "").trim();
              const periodLabel = String(r[historyPeriodLabelIndex] || "").trim();
              if (taskId && periodLabel) {
                alreadySnapshotted.add(taskId + "_" + periodLabel);
              }
            });
          }

          const newRows = [];
          let skippedDuplicate = 0;
          let skippedNoTaskId = 0;

          taskData.forEach(row => {
            const task = Object.fromEntries(
              taskHeaders.map((h, i) => [String(h || "").trim(), row[i]])
            );

            const taskId = String(task.ID || "").trim();

            if (!taskId) {
              skippedNoTaskId++;
              return;
            }

            const uniqueKey = taskId + "_" + period.label;

            if (alreadySnapshotted.has(uniqueKey)) {
              skippedDuplicate++;
              return;
            }

            const snapshot = buildSnapshotComputedFields_(task, period);

            const historyRow = historyHeaders.map(h => {
              switch (h) {
                // ===============================
                // ✅ Old Core Fields
                // ===============================
                case "HistoryID":
                  return "HIST-" + Utilities.getUuid();

                case "TaskID":
                  return task.ID || "";

                case "TaskName":
                  return task.Task || "";

                case "PeriodLabel":
                  return period.label;

                case "PeriodStart":
                  return period.start;

                case "PeriodEnd":
                  return period.end;

                case "Status":
                  return task.Status || "";

                case "ProgressMode":
                  return task.ProgressMode || "";

                case "Progress":
                  return valueOrBlank_(task.Progress);

                case "ProgressOutcome":
                  return valueOrBlank_(task.ProgressOutcome);

                case "BaselineUnit":
                  return task.BaselineUnit || "";

                case "Outcomes":
                  return task.Outcomes || "";

                case "PassOutcomes":
                  return task.PassOutcomes || "";

                case "Challenges":
                  return task.Challenges || "";

                case "NextSteps":
                  return task.NextSteps || "";

                case "RecordedAt":
                  return now;

                // ===============================
                // ✅ Snapshot Control Fields
                // ===============================
                case "SnapshotRunID":
                  return snapshotRunId;

                case "SnapshotAt":
                  return now;

                case "SnapshotBy":
                  return snapshotBy || "SYSTEM";

                // ===============================
                // ✅ Monthly Input Fields
                // ===============================
                case "InputStatus":
                  return snapshot.inputStatusForHistory;

                case "InputPeriodKey":
                  return snapshot.inputPeriodKeyForHistory;

                case "InputPeriodLabel":
                  return snapshot.inputPeriodLabelForHistory;

                case "SubmittedAt":
                  return snapshot.submittedAtForHistory;

                case "SubmittedBy":
                  return snapshot.submittedByForHistory;

                // ===============================
                // ✅ Task Metadata Fields
                // ===============================
                case "Department":
                  return task.Department || "";

                case "WorkGroup":
                  return task.WorkGroup || "";

                case "Assignee":
                  return task.Assignee || "";

                case "Priority":
                  return task.Priority || "";

                case "Deadline":
                  return task.Deadline || "";

                case "SubDep":
                  return task.SubDep || "";

                case "SubDepLabel":
                  return getSubDepLabelFromConfig_(task.SubDep || "", true);

                
                // ===============================
                // ✅ Reporting Schedule Snapshot Fields
                // ===============================
                case "ReportingFrequency":
                  return normalizeReportingFrequencyForSnapshot_(task.ReportingFrequency);

                case "ReportingMonths":
                  return task.ReportingMonths || "";

                case "IsDueThisPeriod":
                  return snapshot.isDueThisPeriod;

                case "ReportingStatus":
                  return snapshot.reportingStatus;



                case "Link":
                  return task.Link || "";


                

                // ===============================
                // ✅ Baseline / Progress Detail Fields
                // ===============================
                case "Baseline":
                  return valueOrBlank_(task.Baseline);

                case "ProgressP":
                  return valueOrBlank_(task.ProgressP);

                case "ProgressH":
                  return valueOrBlank_(task.ProgressH);

                case "ProgressR":
                  return valueOrBlank_(task.ProgressR);

                case "OutcomeUnit":
                  return task.OutcomeUnit || "";

                // ===============================
                // ✅ Evaluation Rule Fields
                // ===============================
                case "EvaluateMode":
                  return task.EvaluateMode || "";

                case "TargetOperator":
                  return task.TargetOperator || "";

                case "TargetValue":
                  return valueOrBlank_(task.TargetValue);

                case "TargetText":
                  return task.TargetText || "";

                case "LevelOrder":
                  return task.LevelOrder || "";

                // ===============================
                // ✅ Calculated Result Fields
                // ===============================
                case "ResultValue":
                  return snapshot.canCarryResult
                    ? valueOrBlank_(task.ResultValue)
                    : "";

                case "ResultText":
                  return snapshot.canCarryResult
                    ? (task.ResultText || "-")
                    : "-";

                case "ResultLevelText":
                  return snapshot.canCarryResult
                    ? (task.ResultLevelText || "")
                    : "";

                case "ResultLevelRank":
                  return snapshot.canCarryResult
                    ? valueOrBlank_(task.ResultLevelRank)
                    : "";

                case "TargetLevelText":
                  return task.TargetLevelText || "";

                case "TargetLevelRank":
                  return valueOrBlank_(task.TargetLevelRank);

                case "AchievementStatus":
                  return snapshot.achievementStatusForHistory;

                case "AchievementText":
                  return snapshot.achievementTextForHistory;

                default:
                  // ✅ เผื่ออนาคตเพิ่ม header ชื่อเดียวกับ TaskData
                  return valueOrBlank_(task[h]);
              }
            });

            newRows.push(historyRow);
          });

          if (newRows.length === 0) {
          return {
            success: true,
            total: 0,
            period: period.label,
            periodKey: period.key,
            sourceTotal: taskData.length,
            skippedDuplicate: skippedDuplicate,
            skippedNoTaskId: skippedNoTaskId,
            fileCreated: false,
            telegramSent: false,
            message:
              skippedDuplicate > 0
                ? "พบข้อมูลรอบนี้ใน TaskHistory แล้ว จึงไม่บันทึกซ้ำ"
                : "ไม่มีรายการใหม่สำหรับบันทึกลง TaskHistory"
          };
        }

          // ===============================
          // ✅ เขียนลง TaskHistory
          // ===============================
        const writeStartRow = historySheet.getLastRow() + 1;

        historySheet
          .getRange(writeStartRow, 1, newRows.length, historyHeaders.length)
          .setValues(newRows);

        // ✅ บังคับให้ Google Sheet เขียนให้เสร็จก่อนตรวจ
        SpreadsheetApp.flush();

        // ✅ ตรวจสอบจากชีตจริงว่าเขียนเข้า TaskHistory แล้วกี่แถว
        const verifiedCount = countTaskHistoryRowsBySnapshotRunId_(snapshotRunId);

          if (verifiedCount !== newRows.length) {
            throw new Error(
              "เขียน TaskHistory ไม่ครบ หรือไม่สำเร็จ" +
              "\nต้องเขียน: " + newRows.length +
              "\nตรวจพบจริง: " + verifiedCount +
              "\nSnapshotRunID: " + snapshotRunId
            );
          }

          // ✅ Step 12: ตรวจคุณภาพ Snapshot หลังเขียนจริง
          const snapshotQA = getSnapshotRunQualitySummary_(snapshotRunId);

          if (!snapshotQA.success) {
            throw new Error(
              snapshotQA.message +
              "\nSnapshotRunID: " + snapshotRunId
            );
          }


          // 🔔 แจ้งเตือนข้อความสรุป
          notifySnapshotFromSheet(period.label);

          let fileUrl = null;

          try {
            fileUrl = createSnapshotFileInDrive(period.label);
          } catch (err) {
            console.error("Create Snapshot File Error:", err);
          }

          if (fileUrl) {
            fileCreated = true;

            const rows = getHistorySummaryForPeriod(period.label);
            const summary = {};

            rows.forEach(r => {
              const key = String(r.status || "").trim() || "ไม่ระบุ";
              summary[key] = (summary[key] || 0) + 1;
            });

            const summaryText = Object.keys(summary).map(status => {
              const emoji = getStatusEmoji(status);
              return `${emoji} ${status}: ${summary[status]}`;
            }).join("\n");

            const message =
              "📊 <b>รายงาน Snapshot งวด: " + period.label + "</b>\n\n" +
              "📌 <b>สรุปสถานะ</b>\n" +
              summaryText +
              "\n\n🔗 เปิดดูได้ที่:\n" + fileUrl;

            sendTelegramAlert_(message);
            telegramSent = true;
          }

          // 🔔 บันทึกเวลา Snapshot ล่าสุด
          PropertiesService.getScriptProperties()
            .setProperty("LAST_SNAPSHOT_AT", now.toISOString());

          return {
            success: true,
            total: newRows.length,
            verifiedCount: verifiedCount,
            snapshotRunId: snapshotRunId,
            period: period.label,
            periodKey: period.key,
            sourceTotal: taskData.length,
            skippedDuplicate: skippedDuplicate,
            skippedNoTaskId: skippedNoTaskId,
            snapshotQA: snapshotQA,
            fileCreated: fileCreated,
            telegramSent: telegramSent
          };
      }

/** ================================
*  // 🔥 ดึง TaskHistory ทั้งหมด (สำหรับทำกราฟ)
* ================================ */

function getAllTaskHistory() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskHistory");

  if (!sheet) return JSON.stringify([]);

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const result = data.map(r =>
    Object.fromEntries(headers.map((h, i) => [h, r[i]]))
  );

  return JSON.stringify(result);
}



/** ================================
*  🔹 โหลดประวัติผลดำเนินการรายเดือน
* ================================ */
    function getTaskHistory(taskId) {
      try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TaskHistory");

        if (!sheet || sheet.getLastRow() < 2) {
          return JSON.stringify([]);
        }

        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();

        const headers = sheet
          .getRange(1, 1, 1, lastCol)
          .getValues()[0]
          .map(h => String(h || "").trim());

        const values = sheet
          .getRange(2, 1, lastRow - 1, lastCol)
          .getValues();

        const taskIdCol = headers.indexOf("TaskID");

        if (taskIdCol === -1) {
          throw new Error("ไม่พบคอลัมน์ TaskID ใน TaskHistory");
        }

        const result = values
          .filter(row => String(row[taskIdCol] || "").trim() === String(taskId || "").trim())
          .map(row => {
            const obj = {};
            headers.forEach((h, i) => {
              obj[h] = row[i];
            });
            return obj;
          })
          .sort((a, b) => {
            const aKey = String(a.InputPeriodKey || a.PeriodStart || a.PeriodLabel || "");
            const bKey = String(b.InputPeriodKey || b.PeriodStart || b.PeriodLabel || "");
            return bKey.localeCompare(aKey);
          });

        return JSON.stringify(result);

      } catch (err) {
        console.error("getTaskHistory ERROR:", err);

        return JSON.stringify({
          success: false,
          message: err.message
        });
      }
    }



    // 🔹 ดึงสรุป Snapshot จาก TaskHistory ตามงวด
          function getHistorySummaryForPeriod(periodLabel) {

        const sheet = SpreadsheetApp.getActive()
          .getSheetByName("TaskHistory");

        const data = sheet.getDataRange().getValues();
        const headers = data.shift();

        const idxTask = headers.indexOf("TaskName");
        const idxStatus = headers.indexOf("Status");
        const idxMode = headers.indexOf("ProgressMode");
        const idxProgress = headers.indexOf("Progress");
        const idxOutcome = headers.indexOf("ProgressOutcome");
        const idxPeriod = headers.indexOf("PeriodLabel");

        Logger.log("periodLabel ที่รับมา: " + periodLabel);
        Logger.log("จำนวนข้อมูลทั้งหมดในชีต: " + data.length);

        // 🔥 สร้าง matched ก่อน
        const matched = data.filter(r => {
          if (!r[idxPeriod]) return false;

          const sheetLabel = String(r[idxPeriod]).trim().replace(/[–—]/g, "-");
          const inputLabel = String(periodLabel).trim().replace(/[–—]/g, "-");

          return sheetLabel === inputLabel;
        });

        Logger.log("จำนวนที่ match จริง: " + matched.length);

        return matched.map(r => ({
          task: r[idxTask],
          status: r[idxStatus],
          mode: r[idxMode],
          result:
            r[idxMode] === "percent"
              ? `${r[idxProgress]} %`
              : r[idxOutcome] || "-"
        }));
      }












function getSystemConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("SystemConfig");
  if (!sh) return {};

  const data = sh.getDataRange().getValues();
  data.shift(); // ตัด header

  const cfg = {};
  data.forEach(([key, value]) => {
    if (!key) return;

    cfg[key] = normalizeBooleanConfigValue_(value);
  });

  return cfg;
}

function saveSnapshotConfig(data, currentUsername) {
  try {
    requireSuperAdmin_(currentUsername);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName("SystemConfig");

    if (!sh) {
      sh = ss.insertSheet("SystemConfig");
      sh.appendRow(["Key", "Value"]);
    }

    sh.clear();
    sh.appendRow(["Key", "Value"]);

    sh.appendRow(["enabled", data.enabled]);
    sh.appendRow(["snapshot_days", data.snapshot_days]);
    sh.appendRow(["snapshot_hour", data.snapshot_hour]);
    sh.appendRow(["snapshot_minute", data.snapshot_minute]);

    return "✅ บันทึกการตั้งค่า Snapshot เรียบร้อย";

  } catch (err) {
    return "❌ " + err.message;
  }
}


function snapshotNow(currentUsername) {
  try {
    requireSuperAdmin_(currentUsername);

    const result = snapshotTasks15Days_(true, currentUsername);

    if (typeof result === "string") {
      return result;
    }

    return "✅ บันทึกผลเดือนก่อนเข้า History สำเร็จ\n\n" +
           "🗓️ เดือนที่บันทึก: " + (result.period || "-") + "\n" +
           "📌 จำนวนที่บันทึก: " + (result.total || 0) + " รายการ\n" +
           "📄 สร้างไฟล์: " + (result.fileCreated ? "สำเร็จ" : "ไม่ได้สร้าง/ไม่มี") + "\n" +
           "📨 แจ้งเตือน Telegram: " + (result.telegramSent ? "ส่งแล้ว" : "ไม่ได้ส่ง");

  } catch (err) {
    console.error("snapshotNow ERROR:", err);
    return "❌ บันทึกผลเดือนก่อนเข้า History ไม่สำเร็จ: " + err.message;
  }
}

          function ensureSheetHeaders_(sheet, requiredHeaders) {
  if (!sheet) {
    throw new Error("ไม่พบชีตสำหรับตรวจ header");
  }

  requiredHeaders = Array.isArray(requiredHeaders) ? requiredHeaders : [];

  // ถ้าชีตยังว่าง ให้สร้าง header ใหม่เลย
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders.slice();
  }

  var lastCol = sheet.getLastColumn();
  var currentHeaders = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function(h) {
      return String(h || "").trim();
    });

  var headerSet = {};
  currentHeaders.forEach(function(h) {
    if (h) headerSet[h] = true;
  });

  var missingHeaders = requiredHeaders.filter(function(h) {
    return h && !headerSet[h];
  });

  if (missingHeaders.length) {
    sheet
      .getRange(1, currentHeaders.length + 1, 1, missingHeaders.length)
      .setValues([missingHeaders]);

    currentHeaders = currentHeaders.concat(missingHeaders);
  }

  return currentHeaders;
}


function ensureTaskHistoryReportingHeaders_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("TaskHistory");

  if (!sheet) {
    sheet = ss.insertSheet("TaskHistory");
  }

  var headers = ensureSheetHeaders_(sheet, HISTORY_HEADERS);

  return {
    sheet: sheet,
    headers: headers
  };
}
          function closeMonthlyPeriod(currentUsername) {
            const lock = LockService.getScriptLock();
            let locked = false;

            try {
              requireSuperAdmin_(currentUsername);

              // ✅ กันกดพร้อมกัน / กัน 2 คนปิดรอบพร้อมกัน
              locked = lock.tryLock(10000);

              if (!locked) {
                return "⏳ ระบบกำลังปิดรอบอยู่ กรุณารอสักครู่แล้วลองใหม่";
              }

              const snapshotState = validateSnapshotStateBeforeClosePeriod_();

              if (!snapshotState.ok) {
                return "❌ ปิดรอบรายเดือนไม่สำเร็จ: " + snapshotState.message;
              }

              const now = new Date();
              const period = getActivePeriodInfo();

              const props = PropertiesService.getScriptProperties();

              const periodMap = getPeriodControlMap_();
              const lastClosedPeriodLabel = String(
                getPeriodControlValue_(periodMap, "LastClosedPeriodLabel") || ""
              ).trim();

              // ✅ กันปิดรอบเดิมซ้ำจาก PeriodControl
              if (lastClosedPeriodLabel === period.label) {
                safeAppendPeriodActionLog_({
                  action: "BLOCK_CLOSE_PERIOD_DUPLICATE",
                  actionLabel: "บล็อกการปิดรอบซ้ำ",
                  beforePeriod: period,
                  afterPeriod: period,
                  success: false,
                  message: "รอบนี้ถูกปิดไปแล้ว: " + period.label,
                  createdBy: currentUsername || ""
                });

                return (
                  "⛔ รอบนี้ถูกปิดไปแล้ว\n\n" +
                  "🗓️ รอบที่ปิดแล้ว: " + period.label + "\n" +
                  "หากต้องการปิดรอบใหม่ ให้ตรวจสอบ ActivePeriod ในชีต PeriodControl"
                );
              }



              // ===============================
              // ✅ 0) Data Quality Check ก่อนปิดรอบ
              // ===============================
              const dqResult = validateDataQualityBeforeClosePeriod_();

              if (!dqResult.success) {
                const detail = formatDQIssueList_(dqResult.issues);

                safeAppendPeriodActionLog_({
                  action: "CLOSE_PERIOD_FAILED_DQ",
                  actionLabel: "ปิดรอบไม่สำเร็จ - ตรวจคุณภาพข้อมูลไม่ผ่าน",
                  beforePeriod: period,
                  afterPeriod: period,
                  snapshotCount: "",
                  success: false,
                  message:
                    "Data Quality Check ไม่ผ่าน\n" +
                    "Critical: " + dqResult.criticalCount +
                    "\nWarning: " + dqResult.warningCount,
                  createdBy: currentUsername || "",
                  meta: {
                    criticalCount: dqResult.criticalCount,
                    warningCount: dqResult.warningCount
                  }
                });

                return (
                  "⛔ ปิดรอบไม่ได้ เพราะตรวจพบข้อมูลสำคัญไม่ครบหรือไม่ถูกต้อง\n\n" +
                  "รายการทั้งหมด: " + dqResult.totalRows + "\n" +
                  "Critical: " + dqResult.criticalCount + "\n" +
                  "Warning: " + dqResult.warningCount + "\n\n" +
                  "ตัวอย่างรายการที่ต้องแก้:\n" +
                  detail + "\n\n" +
                  "กรุณาแก้ข้อมูลก่อน แล้วค่อยกดปิดรอบใหม่อีกครั้ง"
                );
              }
              // ===============================
              // 1) Snapshot ก่อน
              // ===============================
              const snapshotResult = snapshotTasks15Days_(true, currentUsername);

              if (typeof snapshotResult === "string") {
                if (
                  snapshotResult.startsWith("❌") ||
                  snapshotResult.startsWith("⛔")
                ) {
                    safeAppendPeriodActionLog_({
                    action: "CLOSE_PERIOD_FAILED_SNAPSHOT",
                    actionLabel: "ปิดรอบไม่สำเร็จ - Snapshot ไม่ผ่าน",
                    beforePeriod: period,
                    afterPeriod: period,
                    success: false,
                    message: String(snapshotResult || ""),
                    createdBy: currentUsername || ""
                  });

                  return "❌ ปิดรอบไม่สำเร็จ\n\nขั้นตอน Snapshot ไม่ผ่าน:\n" + snapshotResult;
                }
              }


              // ✅ ห้าม reset / เลื่อนรอบ ถ้า Snapshot ไม่ได้เขียนข้อมูลใหม่
                if (
                  !snapshotResult ||
                  typeof snapshotResult !== "object" ||
                  snapshotResult.success !== true ||
                  Number(snapshotResult.total || 0) <= 0
                ) {
                  const message =
                    "Snapshot ไม่ได้บันทึกข้อมูลใหม่ลง TaskHistory" +
                    "\nรอบ: " + (period.label || "-") +
                    "\nจำนวนที่บันทึกใหม่: " + (
                      snapshotResult && typeof snapshotResult === "object"
                        ? snapshotResult.total
                        : "-"
                    ) +
                    "\nหมายเหตุ: อาจมีข้อมูลรอบนี้อยู่แล้ว หรือถูกกันซ้ำ";

                  safeAppendPeriodActionLog_({
                    action: "CLOSE_PERIOD_BLOCKED_EMPTY_SNAPSHOT",
                    actionLabel: "บล็อกการปิดรอบ - Snapshot ว่าง",
                    beforePeriod: period,
                    afterPeriod: period,
                    snapshotCount: snapshotResult && typeof snapshotResult === "object"
                      ? snapshotResult.total
                      : "",
                    success: false,
                    message: message,
                    createdBy: currentUsername || "",
                    meta: snapshotResult || {}
                  });

                  return (
                    "❌ ปิดรอบไม่สำเร็จ\n\n" +
                    message +
                    "\n\nระบบยังไม่ Reset และยังไม่เลื่อนรอบ เพื่อป้องกันข้อมูลหาย"
                  );
                }

              // ===============================
              // 2) Reset หลัง Snapshot สำเร็จ
              // ===============================
              const resetResult = resetMonthlyTaskProgress(currentUsername);

              if (
                typeof resetResult === "string" &&
                (
                  resetResult.startsWith("❌") ||
                  resetResult.startsWith("⛔")
                )
              ) {
                safeAppendPeriodActionLog_({
                action: "CLOSE_PERIOD_FAILED_RESET",
                actionLabel: "ปิดรอบไม่สำเร็จ - Reset ไม่ผ่าน",
                beforePeriod: period,
                afterPeriod: period,
                snapshotCount: snapshotResult && typeof snapshotResult === "object"
                  ? snapshotResult.total
                  : "",
                success: false,
                message: String(resetResult || ""),
                createdBy: currentUsername || ""
              });

              return (
                "⚠️ Snapshot สำเร็จแล้ว แต่ Reset ไม่สำเร็จ\n\n" +
                resetResult
              );
              }

              // ===============================
              // 3) บันทึกรอบที่ปิดแล้วใน PeriodControl
              // ===============================
              updatePeriodControlValue_(
                "LastClosedPeriodKey",
                period.key,
                "รหัสรอบรายงานล่าสุดที่ปิดรอบแล้ว",
                currentUsername
              );

              updatePeriodControlValue_(
                "LastClosedPeriodLabel",
                period.label,
                "ชื่อรอบรายงานล่าสุดที่ปิดรอบแล้ว",
                currentUsername
              );

              updatePeriodControlValue_(
                "LastClosedAt",
                now,
                "วันเวลาที่ปิดรอบล่าสุด",
                currentUsername
              );

              updatePeriodControlValue_(
                "LastClosedBy",
                currentUsername || "",
                "ผู้ที่ปิดรอบล่าสุด",
                currentUsername
              );

              // ===============================
              // 4) เลื่อน ActivePeriod ไปเดือนถัดไป
              // ===============================
              const nextPeriod = getNextMonthPeriodInfo_(period);
              setActivePeriodInfo_(nextPeriod, currentUsername);

              // ===============================
              // 5) เก็บค่าใน Script Properties ไว้ให้ popup ใช้แสดงผลเดิม
              // ===============================
              props.setProperty("LAST_MONTHLY_CLOSE_AT", now.toISOString());
              props.setProperty("LAST_MONTHLY_CLOSE_PERIOD", period.label);

              const snapshotCount =
                snapshotResult && typeof snapshotResult === "object"
                  ? snapshotResult.total
                  : "-";

              
              safeAppendPeriodActionLog_({
                action: "CLOSE_PERIOD",
                actionLabel: "ปิดรอบรายเดือน",
                beforePeriod: period,
                afterPeriod: nextPeriod,
                snapshotCount: snapshotCount,
                success: true,
                message: "ปิดรอบรายเดือนสำเร็จ",
                createdBy: currentUsername || "",
                meta: {
                  snapshotRunId: snapshotResult && snapshotResult.snapshotRunId,
                  verifiedCount: snapshotResult && snapshotResult.verifiedCount,
                  due: snapshotResult && snapshotResult.snapshotQA && snapshotResult.snapshotQA.due,
                  notDue: snapshotResult && snapshotResult.snapshotQA && snapshotResult.snapshotQA.notDue,
                  submitted: snapshotResult && snapshotResult.snapshotQA && snapshotResult.snapshotQA.submitted,
                  notSubmitted: snapshotResult && snapshotResult.snapshotQA && snapshotResult.snapshotQA.notSubmitted,
                  notEvaluable: snapshotResult && snapshotResult.snapshotQA && snapshotResult.snapshotQA.notEvaluable,
                  duplicateSkipped: snapshotResult && snapshotResult.skippedDuplicate,
                  skippedNoTaskId: snapshotResult && snapshotResult.skippedNoTaskId,
                  fileCreated: snapshotResult && snapshotResult.fileCreated,
                  telegramSent: snapshotResult && snapshotResult.telegramSent
                }
              });

              return (
                "✅ ปิดรอบรายเดือนสำเร็จ\n\n" +
                "🗓️ รอบที่ปิด: " + period.label + "\n" +
                "📌 Snapshot ใหม่: " + snapshotCount + " รายการ\n" +
                "🔄 Reset เริ่มรอบใหม่เรียบร้อย\n" +
                "📅 เปิดรอบใหม่: " + nextPeriod.label + "\n\n" +
                "หมายเหตุ: หลังปิดรอบ Dashboard จะกลับเป็นสถานะยังไม่ได้ส่งข้อมูลของรอบใหม่"
              );

            } catch (err) {
              console.error("closeMonthlyPeriod ERROR:", err);
              return "❌ ปิดรอบรายเดือนไม่สำเร็จ: " + err.message;

            } finally {
              if (locked) {
                lock.releaseLock();
              }
            }
          }

function getSnapshotConfig() {
  const cfg = getSystemConfig();

  const props = PropertiesService.getScriptProperties();

  const recordedAt = props.getProperty('LAST_SNAPSHOT_AT');
  const lastMonthlyCloseAt = props.getProperty('LAST_MONTHLY_CLOSE_AT');
  const lastMonthlyClosePeriod = props.getProperty('LAST_MONTHLY_CLOSE_PERIOD');

  return {
    enabled: normalizeBooleanConfigValue_(cfg.enabled) === true,
    snapshot_days: cfg.snapshot_days || "",
    snapshot_hour: cfg.snapshot_hour ?? "",
    snapshot_minute: cfg.snapshot_minute ?? "",

    // เดิม
    recordedAt,

    // ✅ เพิ่มใหม่
    lastMonthlyCloseAt,
    lastMonthlyClosePeriod
  };
}

function isTargetRuleMissingForReadiness_(row) {
  row = row || {};

  const mode = normalizeDQText(row.EvaluateMode).toLowerCase();

  if (!mode) return false;

  if (mode === "percent" || mode === "number") {
    return !normalizeDQText(row.TargetOperator) || !isDQNumber_(row.TargetValue);
  }

  if (mode === "level") {
    return (
      !normalizeDQText(row.LevelOrder) ||
      !normalizeDQText(row.TargetLevelText) ||
      !isDQNumber_(row.TargetLevelRank)
    );
  }

  if (mode === "passfail") {
    return !normalizeDQText(row.PassOutcomes || row.TargetValue);
  }

  return false;
}

function buildMonthlyCloseReadinessSummary_(rows, previewSummary) {
  rows = Array.isArray(rows) ? rows : [];
  previewSummary = previewSummary || {};

  const summary = {
    due: Number(previewSummary.due || 0),
    notDue: Number(previewSummary.notDue || 0),
    submitted: Number(previewSummary.submitted || 0),
    notSubmitted: Number(previewSummary.notSubmitted || 0),
    notEvaluable: Number(previewSummary.notEvaluable || 0),
    evaluable: 0,
    missingEvaluateMode: 0,
    missingTargetRule: 0,
    missingReportingFrequency: 0
  };

  summary.evaluable = Math.max(
    0,
    summary.due - summary.notSubmitted - summary.notEvaluable
  );

  rows.forEach(function(row) {
    if (!normalizeDQText(row.EvaluateMode)) {
      summary.missingEvaluateMode++;
    }

    if (isTargetRuleMissingForReadiness_(row)) {
      summary.missingTargetRule++;
    }

    if (!normalizeDQText(row.ReportingFrequency)) {
      summary.missingReportingFrequency++;
    }
  });

  return summary;
}

function buildMonthlyCloseQueueItem_(row, issueText, recommendedAction, extra) {
  row = row || {};
  extra = extra || {};

  return {
    rowNumber: row._rowNumber || "",
    taskId: String(row.ID || "").trim(),
    taskName: String(row.Task || "").trim(),
    department: String(row.Department || "").trim(),
    workGroup: String(row.WorkGroup || "").trim(),
    assignee: String(row.Assignee || "").trim(),
    reportingFrequency: String(row.ReportingFrequency || "").trim(),
    inputStatus: String(row.InputStatus || "").trim(),
    achievementStatus: String(row.AchievementStatus || "").trim(),
    issueType: extra.issueType || "",
    issueText: issueText || "",
    recommendedAction: recommendedAction || "",
    tags: Array.isArray(extra.tags) ? extra.tags : [],
    severity: extra.severity || "warning",
    reportingStatus: extra.reportingStatus || "",
    submittedBy: String(row.SubmittedBy || "").trim(),
    submittedAt: row.SubmittedAt || ""
  };
}

function buildMonthlyCloseExceptionQueue_(rows, period) {
  rows = Array.isArray(rows) ? rows : [];
  period = period || getActivePeriodInfo();

  const groups = {
    notSubmitted: {
      key: "notSubmitted",
      title: "ยังไม่ส่งข้อมูล",
      description: "รายการที่ถึงรอบรายงานแล้วแต่ยังไม่ได้ส่งข้อมูล",
      items: []
    },
    notEvaluable: {
      key: "notEvaluable",
      title: "ส่งแล้วแต่ประเมินไม่ได้",
      description: "รายการที่มีการส่งข้อมูลแล้ว แต่ยังสรุปผลไม่ได้หรือข้อมูลประเมินไม่ครบ",
      items: []
    },
    configIncomplete: {
      key: "configIncomplete",
      title: "ตั้งค่า KPI ไม่ครบ",
      description: "รายการที่ยังมีช่องตั้งค่าหลักไม่ครบ เช่น รอบรายงาน รูปแบบประเมิน หรือกติกาเป้าหมาย",
      items: []
    },
    notDue: {
      key: "notDue",
      title: "ไม่ถึงรอบรายงาน",
      description: "รายการที่ยังไม่ถึงรอบรายงานในเดือนนี้และจะถูก snapshot เป็น NotDue",
      items: []
    }
  };

  rows.forEach(function(row) {
    const snapshot = buildSnapshotComputedFields_(row, period);
    const rowIssues = [];
    validateTaskRowForCloseDQ_(row, rowIssues, period);

    const missingEvaluateMode = !normalizeDQText(row.EvaluateMode);
    const missingTargetRule = isTargetRuleMissingForReadiness_(row);
    const missingReportingFrequency = !normalizeDQText(row.ReportingFrequency);
    const isDue = snapshot.isDueThisPeriod === true;

    if (isDue && snapshot.reportingStatus === "NotSubmitted") {
      groups.notSubmitted.items.push(
        buildMonthlyCloseQueueItem_(
          row,
          "ถึงรอบรายงานแล้ว แต่ยังไม่มีการส่งข้อมูลของรอบ " + (period.label || "-"),
          "ติดตามผู้รับผิดชอบให้ส่งข้อมูลและตรวจสอบวันส่งก่อนปิดรอบ",
          {
            issueType: "ยังไม่ส่งข้อมูล",
            severity: "critical",
            reportingStatus: snapshot.reportingStatus,
            tags: ["Due", "Waiting Submission"]
          }
        )
      );
    }

    if (
      isDue &&
      (
        snapshot.reportingStatus === "NotEvaluable" ||
        (
          String(row.InputStatus || "").trim() === "Submitted" &&
          rowIssues.some(function(issue) {
            const field = String(issue.field || "").trim();
            return [
              "AchievementStatus",
              "ResultValue",
              "ResultText",
              "ResultLevelText/ResultLevelRank",
              "ProgressOutcome/ResultText",
              "InputPeriodKey",
              "InputPeriodLabel"
            ].indexOf(field) !== -1;
          })
        )
      )
    ) {
      const issueSummary = rowIssues
        .filter(function(issue) {
          return issue.level === "critical" || String(issue.field || "").trim() === "AchievementStatus";
        })
        .slice(0, 2)
        .map(function(issue) {
          return issue.message;
        })
        .join(" | ");

      groups.notEvaluable.items.push(
        buildMonthlyCloseQueueItem_(
          row,
          issueSummary || "มีการส่งข้อมูลแล้ว แต่ยังประเมินผลไม่ได้ในรอบนี้",
          "ตรวจสอบผลลัพธ์ที่บันทึก, period ของข้อมูล, และกติกาการประเมินให้ครบก่อนปิดรอบ",
          {
            issueType: "ส่งแล้วแต่ประเมินไม่ได้",
            severity: "critical",
            reportingStatus: snapshot.reportingStatus,
            tags: ["Submitted", "Not Evaluable"]
          }
        )
      );
    }

    if (missingEvaluateMode || missingTargetRule || missingReportingFrequency) {
      const reasons = [];

      if (missingEvaluateMode) reasons.push("ยังไม่กำหนด EvaluateMode");
      if (missingTargetRule) reasons.push("กติกาเป้าหมายยังไม่ครบ");
      if (missingReportingFrequency) reasons.push("ยังไม่กำหนด ReportingFrequency");

      groups.configIncomplete.items.push(
        buildMonthlyCloseQueueItem_(
          row,
          reasons.join(" | "),
          "ทบทวนการตั้งค่า KPI ใน TaskData ให้ครบก่อนปิดรอบ เพื่อให้ snapshot และ dashboard สรุปผลได้ถูกต้อง",
          {
            issueType: reasons.join(" | "),
            severity: "warning",
            reportingStatus: snapshot.reportingStatus,
            tags: reasons
          }
        )
      );
    }

    if (!isDue) {
      const earlySubmit = String(row.InputStatus || "").trim() === "Submitted";
      groups.notDue.items.push(
        buildMonthlyCloseQueueItem_(
          row,
          earlySubmit
            ? "มีการส่งข้อมูลไว้ล่วงหน้า แต่รอบนี้ยังไม่ถึงกำหนดรายงาน"
            : "รอบนี้ยังไม่ถึงกำหนดรายงาน",
          earlySubmit
            ? "ตรวจสอบว่าต้องการส่งล่วงหน้าจริงหรือไม่ ระบบจะ snapshot เป็น NotDue ในรอบนี้"
            : "ไม่ต้องแก้ไข หากรอบรายงานถูกต้อง ระบบจะข้ามรายการนี้อย่างปลอดภัย",
          {
            issueType: "ยังไม่ถึงรอบรายงาน",
            severity: "info",
            reportingStatus: snapshot.reportingStatus,
            tags: earlySubmit ? ["Not Due", "Early Submission"] : ["Not Due"]
          }
        )
      );
    }
  });

  Object.keys(groups).forEach(function(key) {
    groups[key].items.sort(function(a, b) {
      return String(a.taskName || "").localeCompare(String(b.taskName || ""), "th");
    });
    groups[key].count = groups[key].items.length;
  });

  return {
    totalItems:
      groups.notSubmitted.count +
      groups.notEvaluable.count +
      groups.configIncomplete.count +
      groups.notDue.count,
    groups: groups
  };
}

function getRecentPeriodActionLogsForUI_(limit) {
  const maxRows = Math.max(1, Math.min(Number(limit || 15), 50));
  const sheet = setupPeriodActionLogSheet();

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(h) {
    return String(h || "").trim();
  });

  return values
    .slice(1)
    .filter(function(row) {
      return row.some(function(cell) {
        return cell !== "" && cell !== null;
      });
    })
    .map(function(row) {
      const item = {};

      headers.forEach(function(header, index) {
        item[header] = row[index];
      });

      let meta = {};

      try {
        meta = item.MetaJson ? JSON.parse(item.MetaJson) : {};
      } catch (err) {
        meta = {};
      }

      return {
        logId: String(item.LogID || "").trim(),
        action: String(item.Action || "").trim(),
        actionLabel: String(item.ActionLabel || "").trim(),
        beforePeriodKey: String(item.BeforePeriodKey || "").trim(),
        beforePeriodLabel: String(item.BeforePeriodLabel || "").trim(),
        afterPeriodKey: String(item.AfterPeriodKey || "").trim(),
        afterPeriodLabel: String(item.AfterPeriodLabel || "").trim(),
        snapshotCount: item.SnapshotCount,
        success: String(item.Success || "").trim() === "Y",
        message: String(item.Message || "").trim(),
        createdAt: item.CreatedAt ? new Date(item.CreatedAt).toISOString() : "",
        createdBy: String(item.CreatedBy || "").trim(),
        meta: meta
      };
    })
    .reverse()
    .slice(0, maxRows);
}

function getLatestCloseRelatedLog_(logs) {
  logs = Array.isArray(logs) ? logs : [];

  return logs.find(function(log) {
    const action = String(log && log.action ? log.action : "").trim();
    return [
      "CLOSE_PERIOD",
      "CLOSE_PERIOD_FAILED_DQ",
      "CLOSE_PERIOD_FAILED_SNAPSHOT",
      "CLOSE_PERIOD_BLOCKED_EMPTY_SNAPSHOT",
      "CLOSE_PERIOD_FAILED_RESET",
      "BLOCK_CLOSE_PERIOD_DUPLICATE"
    ].indexOf(action) !== -1;
  }) || null;
}

function buildCloseResultSummaryFromLog_(log) {
  if (!log) {
    return {
      hasResult: false
    };
  }

  const meta = log.meta || {};

  return {
    hasResult: true,
    logId: log.logId || "",
    action: log.action || "",
    actionLabel: log.actionLabel || "",
    success: log.success === true,
    periodKey: log.beforePeriodKey || "",
    periodLabel: log.beforePeriodLabel || "",
    nextPeriodKey: log.afterPeriodKey || "",
    nextPeriodLabel: log.afterPeriodLabel || "",
    snapshotCount: Number(log.snapshotCount || 0),
    dueCount: Number(meta.due || 0),
    notDueCount: Number(meta.notDue || 0),
    submittedCount: Number(meta.submitted || 0),
    notSubmittedCount: Number(meta.notSubmitted || 0),
    notEvaluableCount: Number(meta.notEvaluable || 0),
    duplicateSkippedCount: Number(meta.duplicateSkipped || 0),
    skippedNoTaskIdCount: Number(meta.skippedNoTaskId || 0),
    snapshotRunId: String(meta.snapshotRunId || "").trim(),
    verifiedCount: Number(meta.verifiedCount || 0),
    fileCreated: meta.fileCreated === true,
    telegramSent: meta.telegramSent === true,
    actionAt: log.createdAt || "",
    actionBy: log.createdBy || "",
    note: log.message || ""
  };
}

function isCloseMonthlyPeriodSuccessMessage_(message) {
  const text = String(message || "").trim();
  return text.indexOf("✅ ปิดรอบรายเดือนสำเร็จ") === 0;
}

function buildCloseResultSummaryFromSuccessMessage_(message) {
  const text = String(message || "");
  const periodMatch = text.match(/รอบที่ปิด:\s*([^\n]+)/);
  const nextPeriodMatch = text.match(/เปิดรอบใหม่:\s*([^\n]+)/);
  const snapshotMatch = text.match(/Snapshot ใหม่:\s*(\d+)/);

  return {
    hasResult: true,
    action: "CLOSE_PERIOD",
    actionLabel: "ปิดรอบรายเดือน",
    success: true,
    periodLabel: periodMatch ? periodMatch[1].trim() : "",
    nextPeriodLabel: nextPeriodMatch ? nextPeriodMatch[1].trim() : "",
    snapshotCount: snapshotMatch ? Number(snapshotMatch[1]) : 0,
    note: text,
    fallbackFromMessage: true
  };
}

function buildMonthlyCloseBlockerSummary_(readiness, exceptionQueue, quality) {
  readiness = readiness || {};
  quality = quality || {};

  const queueGroups = exceptionQueue && exceptionQueue.groups
    ? exceptionQueue.groups
    : {};

  const categories = [
    {
      key: "missingReportingFrequency",
      label: "ยังไม่ได้ตั้งค่า ReportingFrequency",
      count: Number(readiness.missingReportingFrequency || 0)
    },
    {
      key: "missingEvaluateMode",
      label: "ยังไม่ได้ตั้งค่า EvaluateMode",
      count: Number(readiness.missingEvaluateMode || 0)
    },
    {
      key: "missingTargetRule",
      label: "ยังไม่ได้ตั้งค่า TargetRule",
      count: Number(readiness.missingTargetRule || 0)
    },
    {
      key: "notSubmitted",
      label: "ยังไม่ส่งข้อมูล",
      count: Number(queueGroups.notSubmitted && queueGroups.notSubmitted.count || 0)
    },
    {
      key: "notEvaluable",
      label: "ส่งแล้วแต่ประเมินไม่ได้",
      count: Number(queueGroups.notEvaluable && queueGroups.notEvaluable.count || 0)
    }
  ];

  return {
    criticalCount: Number(quality.criticalCount || 0),
    warningCount: Number(quality.warningCount || 0),
    categories: categories,
    topCategories: categories.filter(function(item) {
      return Number(item.count || 0) > 0;
    })
  };
}

function buildMonthlyCloseDryRunDebugBase_() {
  return {
    functionName: "runDryRunSnapshotForMonthlyCloseConsole",
    step: "start",
    phase: "init",
    activePeriod: {},
    previewKeys: [],
    consoleDataKeys: [],
    responseKeys: [],
    stackPreview: "",
    errorName: "",
    errorMessage: ""
  };
}

function buildMonthlyCloseDryRunFailureResponse_(debug, message, source, rawError, extras) {
  debug = debug || buildMonthlyCloseDryRunDebugBase_();
  extras = extras || {};

  const safeRawError = rawError
    ? {
        name: rawError.name || "Error",
        message: rawError.message || "",
        stack: rawError.stack ? String(rawError.stack) : ""
      }
    : null;

  if (safeRawError) {
    debug.errorName = safeRawError.name;
    debug.errorMessage = safeRawError.message;
    debug.stackPreview = safeRawError.stack
      ? String(safeRawError.stack).split("\n").slice(0, 3).join(" | ")
      : "";
  }
  debug.phase = "failed";

  return {
    ok: false,
    success: false,
    message: message || "Dry run failed",
    source: source || debug.functionName || debug.step || "runDryRunSnapshotForMonthlyCloseConsole",
    summary: extras.summary || {},
    criticalIssues: Array.isArray(extras.criticalIssues) ? extras.criticalIssues : [],
    warnings: Array.isArray(extras.warnings) ? extras.warnings : [],
    exceptionQueue: extras.exceptionQueue || {},
    debug: debug,
    rawError: safeRawError
  };
}

function getMonthlyCloseManagementConsoleData(currentUsername) {
  const debug = buildMonthlyCloseDryRunDebugBase_();
  debug.functionName = "getMonthlyCloseManagementConsoleData";

  try {
    debug.phase = "permission";
    debug.step = "requireAdminConsoleViewer_";
    const role = requireAdminConsoleViewer_(currentUsername);

    debug.phase = "period";
    debug.step = "getActivePeriodForClient";
    const periodInfo = getActivePeriodForClient();
    debug.activePeriod = {
      key: periodInfo.key || "",
      label: periodInfo.label || "",
      lastClosedPeriodKey: periodInfo.lastClosedPeriodKey || "",
      lastClosedPeriodLabel: periodInfo.lastClosedPeriodLabel || "",
      lastClosedBy: periodInfo.lastClosedBy || "",
      lastClosedAt: periodInfo.lastClosedAt || ""
    };

    debug.phase = "preview";
    debug.step = "previewSnapshotQualityBeforeClosePeriod";
    const preview = previewSnapshotQualityBeforeClosePeriod();
    debug.previewKeys = Object.keys(preview || {});

    debug.phase = "data-quality";
    debug.step = "validateDataQualityBeforeClosePeriod_";
    const dq = validateDataQualityBeforeClosePeriod_();

    debug.phase = "rows";
    debug.step = "getTaskDataRowsForDQ_";
    const rows = getTaskDataRowsForDQ_();

    debug.phase = "logs";
    debug.step = "getRecentPeriodActionLogsForUI_";
    const logs = getRecentPeriodActionLogsForUI_(15);
    const latestCloseLog = getLatestCloseRelatedLog_(logs);

    debug.phase = "readiness";
    debug.step = "buildMonthlyCloseReadinessSummary_";
    const readiness = buildMonthlyCloseReadinessSummary_(rows, preview);

    debug.phase = "exception-queue";
    debug.step = "getActivePeriodInfo";
    const activePeriodInfo = getActivePeriodInfo();
    debug.step = "buildMonthlyCloseExceptionQueue_";
    const exceptionQueue = buildMonthlyCloseExceptionQueue_(rows, activePeriodInfo);

    const quality = {
      canClose: dq.success === true,
      criticalCount: Number(dq.criticalCount || 0),
      warningCount: Number(dq.warningCount || 0),
      totalRows: Number(dq.totalRows || 0),
      issueSummary: dq.issueSummary || buildDQIssueSummaryForUI_(dq.issues || []),
      sampleIssues: Array.isArray(dq.issues) ? dq.issues.slice(0, 12) : [],
      criticalIssues: Array.isArray(dq.criticalIssues) ? dq.criticalIssues.slice(0, 20) : [],
      warnings: Array.isArray(dq.warningIssues) ? dq.warningIssues.slice(0, 20) : []
    };

    debug.phase = "response";
    debug.step = "response-built";
    debug.step = "getSnapshotConfig";
    const snapshotConfig = getSnapshotConfig();
    debug.step = "response-built";

    return {
      success: true,
      ok: true,
      role: role,
      permissions: {
        canDryRun: role === "admin" || role === "superadmin",
        canClose: role === "superadmin"
      },
      periodStatus: {
        currentPeriodKey: periodInfo.key || "",
        currentPeriodLabel: periodInfo.label || "",
        lastClosedPeriodKey: periodInfo.lastClosedPeriodKey || "",
        lastClosedPeriodLabel: periodInfo.lastClosedPeriodLabel || "",
        lastClosedBy: periodInfo.lastClosedBy || "",
        lastClosedAt: periodInfo.lastClosedAt || "",
        readyToClose: dq.success === true,
        readinessLabel: dq.success === true ? "Ready" : "Needs Attention"
      },
      preview: preview,
      readiness: readiness,
      quality: quality,
      blockerSummary: buildMonthlyCloseBlockerSummary_(readiness, exceptionQueue, quality),
      exceptionQueue: exceptionQueue,
      lastCloseResult: buildCloseResultSummaryFromLog_(latestCloseLog),
      actionLogs: logs,
      snapshotConfig: snapshotConfig,
      generatedAt: new Date().toISOString(),
      debug: debug
    };
  } catch (err) {
    const rawError = {
      name: err && err.name ? err.name : "Error",
      message: err && err.message ? err.message : "",
      stack: err && err.stack ? String(err.stack) : ""
    };
    return buildMonthlyCloseDryRunFailureResponse_(
      debug,
      rawError.message || "Failed to load monthly close management console",
      debug.step || "getMonthlyCloseManagementConsoleData",
      rawError,
      {
        summary: {},
        criticalIssues: [],
        warnings: [],
        exceptionQueue: null
      }
    );
  }
}

function runDryRunSnapshotForMonthlyCloseConsole(currentUsername) {
  const debug = buildMonthlyCloseDryRunDebugBase_();
  debug.functionName = "runDryRunSnapshotForMonthlyCloseConsole";

  try {
    debug.phase = "permission";
    debug.step = "requireAdminConsoleViewer_";
    requireAdminConsoleViewer_(currentUsername);

    debug.phase = "load-console-data";
    debug.step = "getMonthlyCloseManagementConsoleData";
    const consoleData = getMonthlyCloseManagementConsoleData(currentUsername);
    const periodStatus = consoleData && consoleData.periodStatus
      ? consoleData.periodStatus
      : {};
    const readiness = consoleData && consoleData.readiness
      ? consoleData.readiness
      : {};
    const quality = consoleData && consoleData.quality
      ? consoleData.quality
      : {};
    const blockerSummary = consoleData && consoleData.blockerSummary
      ? consoleData.blockerSummary
      : {};
    debug.activePeriod = periodStatus;
    debug.previewKeys = consoleData && consoleData.preview ? Object.keys(consoleData.preview || {}) : [];
    debug.consoleDataKeys = Object.keys(consoleData || {});
    debug.phase = "response";
    debug.step = "response-built";

    const response = {
      ok: consoleData && consoleData.success === true,
      success: consoleData && consoleData.success === true,
      source: "runDryRunSnapshotForMonthlyCloseConsole",
      message:
        consoleData && consoleData.success === true
          ? "Dry run completed"
          : (consoleData && consoleData.message) || "Dry run failed",
      summary: {
        periodKey: periodStatus.currentPeriodKey || "",
        periodLabel: periodStatus.currentPeriodLabel || "",
        due: Number(readiness.due || 0),
        notDue: Number(readiness.notDue || 0),
        submitted: Number(readiness.submitted || 0),
        notSubmitted: Number(readiness.notSubmitted || 0),
        evaluable: Number(readiness.evaluable || 0),
        notEvaluable: Number(readiness.notEvaluable || 0),
        missingEvaluateMode: Number(readiness.missingEvaluateMode || 0),
        missingTargetRule: Number(readiness.missingTargetRule || 0),
        missingReportingFrequency: Number(readiness.missingReportingFrequency || 0),
        criticalCount: Number(quality.criticalCount || 0),
        warningCount: Number(quality.warningCount || 0)
      },
      blockerSummary: blockerSummary,
      criticalIssues: quality.criticalIssues || [],
      warnings: quality.warnings || [],
      exceptionQueue: consoleData && consoleData.exceptionQueue
        ? consoleData.exceptionQueue
        : {},
      consoleData: consoleData,
      rawError: consoleData && consoleData.rawError
        ? consoleData.rawError
        : null,
      debug: debug
    };
    response.debug.responseKeys = Object.keys(response);
    return response;
  } catch (err) {
    const rawError = {
      name: err && err.name ? err.name : "Error",
      message: err && err.message ? err.message : "",
      stack: err && err.stack ? String(err.stack) : ""
    };
    return buildMonthlyCloseDryRunFailureResponse_(
      debug,
      rawError.message || "Dry run failed unexpectedly",
      debug.step || "runDryRunSnapshotForMonthlyCloseConsole",
      rawError,
      {
        summary: null,
        criticalIssues: [],
        warnings: [],
        exceptionQueue: null
      }
    );
  }
}

function testRunDryRunSnapshotForMonthlyCloseConsole() {
  const username = getMonthlyCloseConsoleTestUsername_();
  const result = runDryRunSnapshotForMonthlyCloseConsole(username);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function getMonthlyCloseConsoleTestUsername_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("login");
  if (!sheet) {
    throw new Error("login sheet not found");
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    throw new Error("No login users available for test");
  }

  const headers = data[0].map(function(item) {
    return String(item || "").trim().toLowerCase();
  });
  const usernameCol = headers.indexOf("username");
  const roleCol = headers.indexOf("role");

  if (usernameCol === -1 || roleCol === -1) {
    throw new Error("login sheet is missing username/role columns");
  }

  let fallbackUsername = "";
  let adminUsername = "";

  for (let i = 1; i < data.length; i++) {
    const rowUsername = String(data[i][usernameCol] || "").trim();
    const rowRole = String(data[i][roleCol] || "").trim().toLowerCase();

    if (!fallbackUsername && rowUsername) {
      fallbackUsername = rowUsername;
    }

    if (rowRole === "superadmin") {
      return rowUsername;
    }

    if (!adminUsername && rowRole === "admin") {
      adminUsername = rowUsername;
    }
  }

  if (adminUsername) {
    return adminUsername;
  }

  if (fallbackUsername) {
    return fallbackUsername;
  }

  throw new Error("No usable test username found");
}

function runClosePeriodFromMonthlyCloseConsole(currentUsername) {
  requireSuperAdmin_(currentUsername);

  const beforeLogs = getRecentPeriodActionLogsForUI_(1);
  const beforeLogId = beforeLogs.length ? beforeLogs[0].logId : "";
  const message = closeMonthlyPeriod(currentUsername);
  const consoleData = getMonthlyCloseManagementConsoleData(currentUsername);
  const afterLogs = consoleData && Array.isArray(consoleData.actionLogs)
    ? consoleData.actionLogs
    : getRecentPeriodActionLogsForUI_(1);

  const latestLog = afterLogs.length ? afterLogs[0] : null;
  const latestIsNew = latestLog && latestLog.logId !== beforeLogId;
  const fallbackSuccess = !latestIsNew && isCloseMonthlyPeriodSuccessMessage_(message);
  const resultSummary = latestIsNew
    ? buildCloseResultSummaryFromLog_(latestLog)
    : (fallbackSuccess
      ? buildCloseResultSummaryFromSuccessMessage_(message)
      : { hasResult: false });

  return {
    success: latestIsNew ? latestLog.success === true : fallbackSuccess,
    message: message,
    resultSummary: resultSummary,
    consoleData: consoleData
  };
}



function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (!data.message || !data.message.text) {
    return ContentService.createTextOutput("no text");
  }

  return ContentService.createTextOutput("ok");
  /* var chatId = data.message.chat.id; */

  // ส่ง chatId กลับไปในแชท / กลุ่ม
  /* sendMessage(chatId, "📌 chatId ของที่นี่คือ: " + chatId); */
}

function sendMessage(chatId, text) {
  if (!text) return;

  const config = getTelegramConfig_();
  if (!config.botToken || !chatId) return;

  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML"   // 🔥 เพิ่มบรรทัดนี้
  };

  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}
  /* ฟังก์ชันส่งข้อความแบบแบ่งอัตโนมัติ */
function sendLongMessage(chatId, text) {
  const MAX_LENGTH = 4000; // กันชนก่อนถึง 4096

  if (text.length <= MAX_LENGTH) {
    sendMessage(chatId, text);
    return;
  }

  let start = 0;

  while (start < text.length) {
    const chunk = text.substring(start, start + MAX_LENGTH);
    sendMessage(chatId, chunk);
    start += MAX_LENGTH;
  }
}



    // --- ส่วนการตั้งค่า (ตรวจสอบว่ามีอยู่ด้านบนสุดของไฟล์แล้วหรือยัง) ---


function notifyGroup(message) {
  sendTelegramAlert_(message);
}

function testNotify() {
  notifyGroup("🔔 ทดสอบแจ้งเตือนสำเร็จ");
}

function getStatusEmoji(status) {

  if (!status) return "⚪";

  const s = String(status).trim().toLowerCase();

  switch (s) {

    case "pending":
      return "🟡";

    case "in progress":
    case "in-progress":
      return "🔵";

    case "completed":
    case "success":
      return "🟢";

    case "stop":
      return "🔴";

    default:
      return "⚪";
  }
}


function notifySnapshotFromSheet(periodLabel) {

  const rows = getHistorySummaryForPeriod(periodLabel);

  if (rows.length === 0) {
    sendTelegramAlert_("❌ ไม่พบข้อมูล Snapshot สำหรับงวด: " + periodLabel);
    return;
  }

  const header =
    "📥 <b>บันทึกข้อมูลKpi สำเร็จ</b>\n" +
    "📊 ตัวชี้วัด: <b>" + rows.length + "</b> รายการ\n" +
    "🗓️ งวด: <b>" + periodLabel + "</b>\n\n";

  const CHUNK_SIZE = 15; // ส่งครั้งละ 15 รายการ

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {

    const slice = rows.slice(i, i + CHUNK_SIZE);

    const body = slice.map((r, index) => {
      const emoji = getStatusEmoji(r.status);
      return `${i + index + 1}) <b>${r.task}</b>\n` +
             `   • ${r.mode} | ${emoji} <b>${r.status}</b> | ${r.result}`;
    }).join("\n\n");

    const message = (i === 0 ? header : "📌 <b>ต่อ</b>\n\n") + body;

    sendTelegramAlert_(message);
  }
}





function createSnapshotFileInDrive(periodLabel) {

  try {

    const ss = SpreadsheetApp.getActive();
    const historySheet = ss.getSheetByName("TaskHistory");
    if (!historySheet) return null;

    const data = historySheet.getDataRange().getValues();
    const headers = data.shift();
    const idxPeriod = headers.indexOf("PeriodLabel");
    if (idxPeriod === -1) return null;

    const filtered = data.filter(r => r[idxPeriod] === periodLabel);
    if (filtered.length === 0) return null;

    // ============================
    // 🔹 แปลงชื่อไฟล์ให้ปลอดภัย
    // ============================
    const safeLabel = periodLabel
      .replace(/\s+/g, "_")
      .replace(/[–—]/g, "-")
      .replace(/[^\wก-๙\-]/g, "");

    const fileName = "Snapshot_" + safeLabel;

    // ============================
    // 🔐 Folder ID ของคุณ
    // ============================
    const FOLDER_ID = "1xjb6yVE8Wl4w_xRKWNHRwncY0qZ6RT9b";
    const folder = DriveApp.getFolderById(FOLDER_ID);

    // ============================
    // 🔍 เช็คไฟล์ซ้ำ
    // ============================
    const existingFiles = folder.getFilesByName(fileName);
    if (existingFiles.hasNext()) {
      return existingFiles.next().getUrl();
    }

    // ============================
    // 📊 สร้างไฟล์ใหม่
    // ============================
    const newFile = SpreadsheetApp.create(fileName);
    const sh = newFile.getSheets()[0];

    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(2, 1, filtered.length, headers.length).setValues(filtered);
    sh.setFrozenRows(1);

    const file = DriveApp.getFileById(newFile.getId());

    // 🔥 ใช้วิธีใหม่ (ไม่ deprecated)
    file.moveTo(folder);

    // ตั้งค่าแชร์
    file.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );

    return newFile.getUrl();

  } catch (err) {
    console.error("createSnapshotFileInDrive ERROR:", err);
    return null;
  }
}


function getTaskHistoryByTaskId(taskId) {

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("TaskHistory");

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const taskIdIndex = headers.indexOf("TaskID");

  const filtered = data
    .filter(row => row[taskIdIndex] === taskId)
    .map(row =>
      Object.fromEntries(headers.map((h, i) => [h, row[i]]))
    );

  return JSON.stringify(filtered);
}


  /* test ดึงข้อมูลจากHdc */
/* function getCompareChart() {

  var myHosp = "27980";   // ใส่รหัส รพ. คุณ

  var payload = {
    "tableName": "s_ttm35",
    "year": "2569",
    "province": "11",
    "type": "json"
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };

  var response = UrlFetchApp.fetch(
    "https://opendata.moph.go.th/api/report_data",
    options
  );

  var result = JSON.parse(response.getContentText());

  var chartData = [["โรงพยาบาล","ค่า",{ role: "style" }]];

  result.forEach(function(r){

    var color = (r.hospcode == myHosp) ? "color: #1976d2" : "color: #cccccc";

    chartData.push([
      r.hospname,
      Number(r.value),
      color
    ]);

  });

  return chartData;
} */


function resetMonthlyTaskProgress(currentUsername) {
  try {
    requireSuperAdmin_(currentUsername);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const taskSheet = ss.getSheetByName(SHEET_NAME);
    const historySheet = ss.getSheetByName("TaskHistory");

    if (!taskSheet) {
      return "❌ ไม่พบชีต TaskData";
    }

    if (!historySheet) {
      return "❌ ไม่พบชีต TaskHistory";
    }

    const lastRow = taskSheet.getLastRow();
    const lastCol = taskSheet.getLastColumn();

    if (lastRow < 2) {
      return "⚠️ ไม่มีข้อมูล Task ให้ Reset";
    }

    const now = new Date();
    const period = getActivePeriodInfo();

    // ==============================
    // ✅ 1) ตรวจว่าบันทึกเดือนก่อนเข้า History แล้วหรือยัง
    // ==============================
    const taskHeaders = taskSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const taskValues = taskSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const taskIdCol = taskHeaders.indexOf("ID");
    const taskNameCol = taskHeaders.indexOf("Task");

    if (taskIdCol === -1) {
      return "❌ ไม่พบคอลัมน์ ID ใน TaskData";
    }

    const historyData = historySheet.getDataRange().getValues();
    const historyHeaders = historyData.shift();

    const historyTaskIdCol = historyHeaders.indexOf("TaskID");
    const historyPeriodLabelCol = historyHeaders.indexOf("PeriodLabel");

    if (historyTaskIdCol === -1 || historyPeriodLabelCol === -1) {
      return "❌ ไม่พบคอลัมน์ TaskID หรือ PeriodLabel ใน TaskHistory";
    }

    const historyKeys = new Set(
      historyData
        .filter(r => r[historyTaskIdCol] && r[historyPeriodLabelCol])
        .map(r => `${r[historyTaskIdCol]}_${r[historyPeriodLabelCol]}`)
    );

    const missingTasks = [];

    taskValues.forEach(row => {
      const taskId = row[taskIdCol];
      if (!taskId) return;

      const key = `${taskId}_${period.label}`;

      if (!historyKeys.has(key)) {
        missingTasks.push({
          id: taskId,
          name: taskNameCol !== -1 ? row[taskNameCol] : ""
        });
      }
    });

    if (missingTasks.length > 0) {
      const sampleNames = missingTasks
        .slice(0, 5)
        .map(t => `- ${t.name || t.id}`)
        .join("\n");

      return (
        `⛔ ยัง Reset ไม่ได้\n` +
        `ยังมี ${missingTasks.length} รายการที่ยังไม่ถูกบันทึกเข้า TaskHistory ของเดือน ${period.label}\n\n` +
        `ตัวอย่างรายการที่ยังไม่พบใน History:\n${sampleNames}\n\n` +
        `กรุณากด “บันทึกผลเดือนก่อนเข้า History” ก่อน แล้วค่อย Reset`
      );
    }

    // ==============================
    // ✅ 2) Reset ค่าใน TaskData
    // ==============================
        const statusCol = taskHeaders.indexOf("Status");
        const progressCol = taskHeaders.indexOf("Progress");
        const progressOutcomeCol = taskHeaders.indexOf("ProgressOutcome");
        const challengesCol = taskHeaders.indexOf("Challenges");
        const nextStepsCol = taskHeaders.indexOf("NextSteps");
        const updatedAtCol = taskHeaders.indexOf("UpdatedAt");

        // ✅ Monthly Input Status Fields
        const inputStatusCol = taskHeaders.indexOf("InputStatus");
        const inputPeriodKeyCol = taskHeaders.indexOf("InputPeriodKey");
        const inputPeriodLabelCol = taskHeaders.indexOf("InputPeriodLabel");
        const submittedAtCol = taskHeaders.indexOf("SubmittedAt");
        const submittedByCol = taskHeaders.indexOf("SubmittedBy");

        // ✅ Calculated Result Fields
        const resultValueCol = taskHeaders.indexOf("ResultValue");
        const resultTextCol = taskHeaders.indexOf("ResultText");
        const resultLevelTextCol = taskHeaders.indexOf("ResultLevelText");
        const resultLevelRankCol = taskHeaders.indexOf("ResultLevelRank");
        const targetLevelTextCol = taskHeaders.indexOf("TargetLevelText");
        const targetLevelRankCol = taskHeaders.indexOf("TargetLevelRank");
        const achievementStatusCol = taskHeaders.indexOf("AchievementStatus");
        const achievementTextCol = taskHeaders.indexOf("AchievementText");

    if (progressCol === -1) {
      return "❌ ไม่พบคอลัมน์ Progress";
    }

      taskValues.forEach(row => {
        if (statusCol !== -1) {
          row[statusCol] = "Pending";
        }

        // ✅ Reset เดือนใหม่ = ยังไม่กรอก ไม่ใช่กรอก 0
        if (progressCol !== -1) {
          row[progressCol] = "";
        }

        if (progressOutcomeCol !== -1) {
          row[progressOutcomeCol] = "";
        }

        if (challengesCol !== -1) {
          row[challengesCol] = "";
        }

        if (nextStepsCol !== -1) {
          row[nextStepsCol] = "";
        }

        // ✅ Monthly Input Status
        if (inputStatusCol !== -1) {
          row[inputStatusCol] = "NotSubmitted";
        }

        if (inputPeriodKeyCol !== -1) {
          row[inputPeriodKeyCol] = "";
        }

        if (inputPeriodLabelCol !== -1) {
          row[inputPeriodLabelCol] = "";
        }

        if (submittedAtCol !== -1) {
          row[submittedAtCol] = "";
        }

        if (submittedByCol !== -1) {
          row[submittedByCol] = "";
        }

        // ✅ Calculated Result
        if (resultValueCol !== -1) {
          row[resultValueCol] = "";
        }

        if (resultTextCol !== -1) {
          row[resultTextCol] = "-";
        }

        if (resultLevelTextCol !== -1) {
          row[resultLevelTextCol] = "";
        }

        if (resultLevelRankCol !== -1) {
          row[resultLevelRankCol] = "";
        }

        // ❌ ไม่ล้าง TargetLevelText / TargetLevelRank
        // เพราะเป็นข้อมูลเป้าหมายของตัวชี้วัด ไม่ใช่ผลรายเดือน
        // ถ้าค่าว่าง ให้ใช้ repairLevelTargetFieldsForDQ() ซ่อมแทน

        // if (targetLevelTextCol !== -1) {
        //   row[targetLevelTextCol] = "";
        // }

        // if (targetLevelRankCol !== -1) {
        //   row[targetLevelRankCol] = "";
        // }

        if (achievementStatusCol !== -1) {
          row[achievementStatusCol] = "NoData";
        }

        if (achievementTextCol !== -1) {
          row[achievementTextCol] = "ไม่มีข้อมูล";
        }

        if (updatedAtCol !== -1) {
          row[updatedAtCol] = now;
        }
      });

    taskSheet
      .getRange(2, 1, taskValues.length, lastCol)
      .setValues(taskValues);

    return `✅ Reset เริ่มเดือนใหม่สำเร็จ\nตรวจพบว่าบันทึกผลเดือน ${period.label} เข้า History ครบแล้ว`;

  } catch (err) {
    console.error("resetMonthlyTaskProgress ERROR:", err);
    return "❌ Reset ไม่สำเร็จ: " + err.message;
  }
}


function evaluateAchievement(task) {
  const mode = String(task.EvaluateMode || task.ProgressMode || '').trim();
  const operator = String(task.TargetOperator || '').trim();
  const unit = String(task.BaselineUnit || task.OutcomeUnit || '').trim();

  const noData = {
    ResultValue: '',
    ResultText: '-',
    ResultLevelText: '',
    ResultLevelRank: '',
    TargetLevelText: '',
    TargetLevelRank: '',
    TargetText: task.TargetText || '',
    AchievementStatus: 'NoData',
    AchievementText: 'ไม่มีข้อมูล'
  };

  // =========================
  // percent / number
  // =========================
  if (mode === 'percent' || mode === 'number') {
    const rawResult = task.Progress;
    const rawTarget = task.TargetValue;

    if (rawResult === '' || rawResult === null || rawResult === undefined) {
      return noData;
    }

    if (rawTarget === '' || rawTarget === null || rawTarget === undefined) {
      return {
        ...noData,
        ResultValue: rawResult,
        ResultText: formatResultTextByMode_(
          mode,
          normalizePercentNumber_(rawResult, mode, unit),
          task.OutcomeUnit,
          task.BaselineUnit
        ),
        AchievementStatus: 'NotEvaluable',
        AchievementText: 'ยังประเมินไม่ได้'
      };
    }

    const resultValue = normalizePercentNumber_(rawResult, mode, unit);
    const targetValue = normalizePercentNumber_(rawTarget, mode, unit);

    if (Number.isNaN(resultValue) || Number.isNaN(targetValue)) {
      return {
        ...noData,
        ResultValue: rawResult,
        ResultText: String(rawResult),
        AchievementStatus: 'NotEvaluable',
        AchievementText: 'ยังประเมินไม่ได้'
      };
    }

    const op = operator || '>=';
    let isMet = false;

    if (op === '>=') isMet = resultValue >= targetValue;
    else if (op === '<=') isMet = resultValue <= targetValue;
    else if (op === '=') isMet = resultValue === targetValue;
    else isMet = false;

    const targetText = task.TargetText || formatTargetText(op, targetValue, mode, unit);

    return {
      ResultValue: resultValue,
      ResultText: formatResultTextByMode_(
        mode,
        resultValue,
        task.OutcomeUnit,
        task.BaselineUnit
      ),
      ResultLevelText: '',
      ResultLevelRank: '',
      TargetLevelText: '',
      TargetLevelRank: '',
      TargetText: targetText,
      AchievementStatus: isMet ? 'Met' : 'NotMet',
      AchievementText: isMet ? 'บรรลุเป้าหมาย' : 'ไม่บรรลุเป้าหมาย'
    };
  }

  // =========================
  // level
  // =========================
  if (mode === 'level') {
    const resultText = String(task.ProgressOutcome || '').trim();

    if (!resultText) {
      return noData;
    }

    const levelOrder = splitCsv(task.LevelOrder || task.Outcomes);
    const targetLevel = String(task.TargetValue || task.TargetLevelText || '').trim();

    const resultRank = levelOrder.indexOf(resultText);
    const targetRank = levelOrder.indexOf(targetLevel);

    // ถ้ามี LevelOrder และ TargetValue ชัดเจน ใช้ rank คำนวณ
    if (levelOrder.length && resultRank !== -1 && targetRank !== -1) {
      const op = operator || '>=';

      let isMet = false;
      if (op === '>=') isMet = resultRank >= targetRank;
      else if (op === '<=') isMet = resultRank <= targetRank;
      else if (op === '=') isMet = resultRank === targetRank;

      return {
        ResultValue: resultText,
        ResultText: resultText,
        ResultLevelText: resultText,
        ResultLevelRank: resultRank,
        TargetLevelText: targetLevel,
        TargetLevelRank: targetRank,
        TargetText: task.TargetText || `${targetLevel}ขึ้นไป`,
        AchievementStatus: isMet ? 'Met' : 'NotMet',
        AchievementText: isMet ? 'บรรลุเป้าหมาย' : 'ไม่บรรลุเป้าหมาย'
      };
    }

    // fallback: ใช้ PassOutcomes
    const passOutcomes = splitCsv(task.PassOutcomes);
    const isMet = passOutcomes.includes(resultText);

    return {
      ResultValue: resultText,
      ResultText: resultText,
      ResultLevelText: resultText,
      ResultLevelRank: resultRank !== -1 ? resultRank : '',
      TargetLevelText: targetLevel,
      TargetLevelRank: targetRank !== -1 ? targetRank : '',
      TargetText: task.TargetText || passOutcomes.join(', '),
      AchievementStatus: isMet ? 'Met' : 'NotMet',
      AchievementText: isMet ? 'บรรลุเป้าหมาย' : 'ไม่บรรลุเป้าหมาย'
    };
  }

  // =========================
  // passfail
  // =========================
  if (mode === 'passfail') {
    const resultText = String(task.ProgressOutcome || '').trim();

    if (!resultText) {
      return noData;
    }

    const passOutcomes = splitCsv(task.PassOutcomes);
    const isMet = passOutcomes.includes(resultText);

    return {
      ResultValue: resultText,
      ResultText: resultText,
      ResultLevelText: '',
      ResultLevelRank: '',
      TargetLevelText: '',
      TargetLevelRank: '',
      TargetText: task.TargetText || passOutcomes.join(', '),
      AchievementStatus: isMet ? 'Met' : 'NotMet',
      AchievementText: isMet ? 'บรรลุเป้าหมาย' : 'ไม่บรรลุเป้าหมาย'
    };
  }

  return {
    ...noData,
    AchievementStatus: 'NotEvaluable',
    AchievementText: 'ยังประเมินไม่ได้'
  };
}



function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function normalizePercentNumber_(value, mode, unit) {
  if (value === "" || value === null || value === undefined) return value;

  const n = Number(value);
  if (isNaN(n)) return value;

  const isPercent =
    String(mode || "").trim() === "percent" ||
    String(unit || "").trim() === "ร้อยละ" ||
    String(unit || "").trim() === "%";

  // ✅ กรณี Google Sheet เก็บ 5% เป็น 0.05 ให้แปลงเป็น 5
  if (isPercent && n > 0 && n <= 1) {
    return n * 100;
  }

  return n;
}

function formatTargetText(operator, value, mode, unit) {
  const symbolMap = {
    '>=': '≥',
    '<=': '≤',
    '=': '='
  };

  const symbol = symbolMap[operator] || operator || '≥';

  if (mode === 'percent') {
    return `${symbol} ${value}%`;
  }

  if (unit) {
    return `${symbol} ${value} ${unit}`;
  }

  return `${symbol} ${value}`;
}


function recalculateAllAchievements() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = setupSheet();

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 2) {
      return '⚠️ ไม่มีข้อมูลให้คำนวณ';
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
    const values = range.getValues();

    const indexMap = {};
    headers.forEach((h, i) => indexMap[h] = i);

    let updated = 0;

    values.forEach(row => {
      const task = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
      const result = evaluateAchievement(task);

      setIfExists(row, indexMap, 'ResultValue', result.ResultValue);
      setIfExists(row, indexMap, 'ResultText', result.ResultText);
      setIfExists(row, indexMap, 'ResultLevelText', result.ResultLevelText);
      setIfExists(row, indexMap, 'ResultLevelRank', result.ResultLevelRank);
      setIfExists(row, indexMap, 'TargetLevelText', result.TargetLevelText);
      setIfExists(row, indexMap, 'TargetLevelRank', result.TargetLevelRank);
      setIfExists(row, indexMap, 'TargetText', result.TargetText);
      setIfExists(row, indexMap, 'AchievementStatus', result.AchievementStatus);
      setIfExists(row, indexMap, 'AchievementText', result.AchievementText);

      updated++;
    });

    range.setValues(values);

    return `✅ คำนวณผลประเมินสำเร็จ ${updated} รายการ`;

  } catch (err) {
    console.error('recalculateAllAchievements ERROR:', err);
    return '❌ คำนวณไม่สำเร็จ: ' + err.message;
  }
}

function setIfExists(row, indexMap, field, value) {
  if (indexMap[field] !== undefined && indexMap[field] !== -1) {
    row[indexMap[field]] = value;
  }
}



function updateAchievementForRow(sheet, rowIndex) {
  try {
    const lastCol = sheet.getLastColumn();

    const headers = sheet
      .getRange(1, 1, 1, lastCol)
      .getValues()[0]
      .map(h => String(h || '').trim());

    const row = sheet
      .getRange(rowIndex, 1, 1, lastCol)
      .getValues()[0];

    const task = Object.fromEntries(
      headers.map((h, i) => [h, row[i]])
    );

    const result = evaluateAchievement(task);

    const indexMap = {};
    headers.forEach((h, i) => {
      indexMap[h] = i;
    });

    setIfExists(row, indexMap, 'ResultValue', result.ResultValue);
    setIfExists(row, indexMap, 'ResultText', result.ResultText);
    setIfExists(row, indexMap, 'ResultLevelText', result.ResultLevelText);
    setIfExists(row, indexMap, 'ResultLevelRank', result.ResultLevelRank);
    setIfExists(row, indexMap, 'TargetLevelText', result.TargetLevelText);
    setIfExists(row, indexMap, 'TargetLevelRank', result.TargetLevelRank);
    setIfExists(row, indexMap, 'TargetText', result.TargetText);
    setIfExists(row, indexMap, 'AchievementStatus', result.AchievementStatus);
    setIfExists(row, indexMap, 'AchievementText', result.AchievementText);

    sheet
      .getRange(rowIndex, 1, 1, lastCol)
      .setValues([row]);

    return result;

  } catch (err) {
    console.error('updateAchievementForRow ERROR:', err);
    return null;
  }
}

function ensureInputStatusColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error("ไม่พบชีต TaskData");
  }

  const requiredHeaders = [
    'InputStatus',
    'InputPeriodKey',
    'InputPeriodLabel',
    'SubmittedAt',
    'SubmittedBy'
  ];

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(h => String(h || '').trim());

  requiredHeaders.forEach(header => {
    if (!currentHeaders.includes(header)) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(header);
      sheet.getRange(1, nextCol).setFontWeight('bold');
      currentHeaders.push(header);
    }
  });

  return "✅ เพิ่มคอลัมน์สถานะการกรอกข้อมูลเรียบร้อย";
}

function getCurrentInputPeriodInfo() {
  // ✅ ใช้รอบรายงานจาก PeriodControl เป็นแหล่งข้อมูลกลาง
  return getActivePeriodInfo();
}



function setTextCellByHeader(sheet, rowIndex, headerName, value) {
  const lastCol = sheet.getLastColumn();

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(h => String(h || "").trim());

  const colIndex = headers.indexOf(headerName);

  if (colIndex !== -1) {
    sheet
      .getRange(rowIndex, colIndex + 1)
      .setNumberFormat("@")
      .setValue(String(value || ""));
  }
}

function setCellByHeader(sheet, rowIndex, headerName, value) {
  const lastCol = sheet.getLastColumn();

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(h => String(h || '').trim());

  const colIndex = headers.indexOf(headerName);

  if (colIndex !== -1) {
    sheet.getRange(rowIndex, colIndex + 1).setValue(value);
  }
}

function setDateTimeCellByHeader(sheet, rowIndex, headerName, value) {
  const lastCol = sheet.getLastColumn();

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(h => String(h || '').trim());

  const colIndex = headers.indexOf(headerName);

  if (colIndex !== -1) {
    sheet
      .getRange(rowIndex, colIndex + 1)
      .setValue(value)
      .setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
}


function markTaskSubmittedForRow(sheet, rowIndex, submittedBy) {
  const period = getCurrentInputPeriodInfo();
  const now = new Date();

  setCellByHeader(sheet, rowIndex, 'InputStatus', 'Submitted');
  setTextCellByHeader(sheet, rowIndex, 'InputPeriodKey', period.key);
  setCellByHeader(sheet, rowIndex, 'InputPeriodLabel', period.label);

  // ✅ เก็บวันและเวลาแบบเต็ม
  setDateTimeCellByHeader(sheet, rowIndex, 'SubmittedAt', now);

  setCellByHeader(sheet, rowIndex, 'SubmittedBy', submittedBy || '');
}


function hasMonthlyInput(taskObject) {
  if (!taskObject) return false;

  const mode = String(
    taskObject.evaluateMode ||
    taskObject.EvaluateMode ||
    taskObject.progressMode ||
    taskObject.ProgressMode ||
    ""
  ).trim();

  const progress =
    taskObject.progress !== undefined
      ? taskObject.progress
      : taskObject.Progress;

  const progressOutcome =
    taskObject.progressOutcome !== undefined
      ? taskObject.progressOutcome
      : taskObject.ProgressOutcome;

  if (mode === "percent" || mode === "number") {
    return hasRealValue_(progress);
  }

  if (mode === "level" || mode === "passfail") {
    return hasRealValue_(progressOutcome);
  }

  return hasRealValue_(progress) || hasRealValue_(progressOutcome);
}



            function getSubDepLabel(subDepValue) {
              if (!subDepValue) return "-";

              const parts = String(subDepValue).split(":");
              const groupKey = parts[0]; // IR, HA
              const code = parts[1];     // A, MSO

              const group = SUBDEP_CONFIG[groupKey];
              if (!group) return subDepValue;

              const found = group.options.find(item => item.code === code);
              if (!found) return subDepValue;

              return found.label;
            }

            function getSubDepFullLabel(subDepValue) {
              if (!subDepValue) return "-";

              const parts = String(subDepValue).split(":");
              const groupKey = parts[0];
              const code = parts[1];

              const group = SUBDEP_CONFIG[groupKey];
              if (!group) return subDepValue;

              const found = group.options.find(item => item.code === code);
              if (!found) return subDepValue;

              return group.label + " / " + found.label;
            }



        function setupSubDepConfigSheet() {
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          let sheet = ss.getSheetByName("SubDepConfig");

          if (!sheet) {
            sheet = ss.insertSheet("SubDepConfig");
          }

          const headers = [
            "GroupKey",
            "GroupLabel",
            "Code",
            "Label",
            "FullLabel",
            "Color",
            "SortOrder",
            "Active"
          ];

          sheet.clear();
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
          sheet.setFrozenRows(1);

          const rows = [
            // =========================
            // IR: ตัวชี้วัดตรวจราชการ เขต 3
            // =========================
            ["IR", "ตัวชี้วัดตรวจราชการ เขต 3", "A", "ส่งเสริมป้องกันโรค", "ตัวชี้วัดตรวจราชการ เขต 3 / ส่งเสริมป้องกันโรค", "orange", 1, true],
            ["IR", "ตัวชี้วัดตรวจราชการ เขต 3", "B", "โรคติดต่อ", "ตัวชี้วัดตรวจราชการ เขต 3 / โรคติดต่อ", "orange", 2, true],
            ["IR", "ตัวชี้วัดตรวจราชการ เขต 3", "C", "โรค NCD", "ตัวชี้วัดตรวจราชการ เขต 3 / โรค NCD", "orange", 3, true],
            ["IR", "ตัวชี้วัดตรวจราชการ เขต 3", "D", "แม่และเด็ก", "ตัวชี้วัดตรวจราชการ เขต 3 / แม่และเด็ก", "orange", 4, true],
            ["IR", "ตัวชี้วัดตรวจราชการ เขต 3", "E", "ประสิทธิภาพการบริการ", "ตัวชี้วัดตรวจราชการ เขต 3 / ประสิทธิภาพการบริการ", "orange", 5, true],
            ["IR", "ตัวชี้วัดตรวจราชการ เขต 3", "F", "สุขภาพจิต/ยาเสพติด", "ตัวชี้วัดตรวจราชการ เขต 3 / สุขภาพจิต/ยาเสพติด", "orange", 6, true],
            ["IR", "ตัวชี้วัดตรวจราชการ เขต 3", "G", "เศรษฐกิจสุขภาพ/แพทย์แผนไทย", "ตัวชี้วัดตรวจราชการ เขต 3 / เศรษฐกิจสุขภาพ/แพทย์แผนไทย", "orange", 7, true],
            ["IR", "ตัวชี้วัดตรวจราชการ เขต 3", "H", "Back office", "ตัวชี้วัดตรวจราชการ เขต 3 / Back office", "orange", 8, true],

            // =========================
            // HA: ตัวชี้วัดงานคุณภาพ
            // =========================
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "MSO", "MSO", "ตัวชี้วัดงานคุณภาพ (HA) / MSO", "blue", 1, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "NSO", "NSO", "ตัวชี้วัดงานคุณภาพ (HA) / NSO", "blue", 2, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "RM", "RM", "ตัวชี้วัดงานคุณภาพ (HA) / RM", "blue", 3, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "ENV", "ENV", "ตัวชี้วัดงานคุณภาพ (HA) / ENV", "blue", 4, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "IM", "IM", "ตัวชี้วัดงานคุณภาพ (HA) / IM", "blue", 5, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "PIC", "PIC", "ตัวชี้วัดงานคุณภาพ (HA) / PIC", "blue", 6, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "COM", "COM", "ตัวชี้วัดงานคุณภาพ (HA) / COM", "blue", 7, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "PCT", "PCT", "ตัวชี้วัดงานคุณภาพ (HA) / PCT", "blue", 8, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "HRD", "HRD", "ตัวชี้วัดงานคุณภาพ (HA) / HRD", "blue", 9, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "CFO", "CFO", "ตัวชี้วัดงานคุณภาพ (HA) / CFO", "blue", 10, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "LAB", "LAB", "ตัวชี้วัดงานคุณภาพ (HA) / LAB", "blue", 11, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "TTC", "TTC", "ตัวชี้วัดงานคุณภาพ (HA) / TTC", "blue", 12, true],
            ["HA", "ตัวชี้วัดงานคุณภาพ (HA)", "PTC", "PTC", "ตัวชี้วัดงานคุณภาพ (HA) / PTC", "blue", 13, true]
          ];

          sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
          sheet.autoResizeColumns(1, headers.length);

          return "✅ สร้าง SubDepConfig สำเร็จ " + rows.length + " รายการ";
        }

        function getSubDepConfigRows_() {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            const sheet = ss.getSheetByName("SubDepConfig");

            if (!sheet) {
              return [];
            }

            const lastRow = sheet.getLastRow();
            const lastCol = sheet.getLastColumn();

            if (lastRow < 2) {
              return [];
            }

            const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
              .map(h => String(h || "").trim());

            const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

            function col(name) {
              return headers.indexOf(name);
            }

            const groupKeyCol = col("GroupKey");
            const groupLabelCol = col("GroupLabel");
            const codeCol = col("Code");
            const labelCol = col("Label");
            const fullLabelCol = col("FullLabel");
            const colorCol = col("Color");
            const sortOrderCol = col("SortOrder");
            const activeCol = col("Active");

            if (groupKeyCol === -1 || codeCol === -1 || labelCol === -1) {
              throw new Error("SubDepConfig ขาดคอลัมน์หลัก GroupKey / Code / Label");
            }

            return values
              .map(row => {
                const activeValue = activeCol !== -1 ? row[activeCol] : true;
                const isActive =
                  activeValue === true ||
                  String(activeValue).toUpperCase() === "TRUE" ||
                  String(activeValue) === "1";

                return {
                  groupKey: String(row[groupKeyCol] || "").trim(),
                  groupLabel: groupLabelCol !== -1 ? String(row[groupLabelCol] || "").trim() : "",
                  code: String(row[codeCol] || "").trim(),
                  label: String(row[labelCol] || "").trim(),
                  fullLabel: fullLabelCol !== -1 ? String(row[fullLabelCol] || "").trim() : "",
                  color: colorCol !== -1 ? String(row[colorCol] || "").trim() : "",
                  sortOrder: sortOrderCol !== -1 ? Number(row[sortOrderCol] || 999) : 999,
                  active: isActive
                };
              })
              .filter(item => item.groupKey && item.code && item.active)
              .sort((a, b) => {
                if (a.groupKey !== b.groupKey) {
                  return a.groupKey.localeCompare(b.groupKey);
                }
                return a.sortOrder - b.sortOrder;
              });
          }


          function getSubDepConfig() {
            try {
              const rows = getSubDepConfigRows_();
              const config = {};

              rows.forEach(item => {
                if (!config[item.groupKey]) {
                  config[item.groupKey] = {
                    label: item.groupLabel || item.groupKey,
                    color: item.color || "slate",
                    options: []
                  };
                }

                config[item.groupKey].options.push({
                  code: item.code,
                  label: item.label,
                  fullLabel: item.fullLabel || ((item.groupLabel || item.groupKey) + " / " + item.label),
                  sortOrder: item.sortOrder
                });
              });

              return JSON.stringify({
                success: true,
                data: config
              });

            } catch (err) {
              console.error("getSubDepConfig ERROR:", err);
              return JSON.stringify({
                success: false,
                message: err.message || "โหลด SubDepConfig ไม่สำเร็จ",
                data: {}
              });
            }
          }


          function getSubDepLabelFromConfig_(subDepValue, useFullLabel) {
            if (!subDepValue) return "";

            const raw = String(subDepValue).trim();
            const parts = raw.split(":");

            if (parts.length < 2) {
              return raw;
            }

            const groupKey = parts[0];
            const code = parts[1];

            const rows = getSubDepConfigRows_();

            const found = rows.find(item =>
              String(item.groupKey) === String(groupKey) &&
              String(item.code) === String(code)
            );

            if (!found) {
              return raw;
            }

            if (useFullLabel) {
              return found.fullLabel || ((found.groupLabel || groupKey) + " / " + found.label);
            }

            return found.label || raw;
          }

          function testGetSubDepConfig() {
              Logger.log(getSubDepConfig());
              Logger.log(getSubDepLabelFromConfig_("IR:A", true));
              Logger.log(getSubDepLabelFromConfig_("HA:COM", true));
            }

            function repairActivePeriodKey() {
              setupPeriodControlSheet();

              const active = getActivePeriodInfo();

              if (!active.start) {
                return "❌ ไม่พบ ActivePeriodStart";
              }

              const d = new Date(active.start);
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

              updatePeriodControlValue_(
                "ActivePeriodKey",
                key,
                "รหัสรอบรายงานที่กำลังเปิดให้กรอก เช่น 2026-04",
                "SYSTEM_REPAIR"
              );

              return "✅ ซ่อม ActivePeriodKey เป็น " + key;
            }

            function testNextPeriodFromActive() {
              const active = getActivePeriodInfo();
              const next = getNextMonthPeriodInfo_(active);

              Logger.log("Active = " + active.key + " / " + active.label);
              Logger.log("Next = " + next.key + " / " + next.label);

              return "Active: " + active.label + " → Next: " + next.label;
            }
          function getCalendarMonthPeriodInfo_(date) {
            const d = date ? new Date(date) : new Date();

            const year = d.getFullYear();
            const monthIndex = d.getMonth();

            const start = new Date(year, monthIndex, 1);
            const end = new Date(year, monthIndex + 1, 0);

            const thaiMonths = [
              "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
              "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
            ];

            return {
              key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
              label: `${thaiMonths[monthIndex]} ${year + 543}`,
              start: start,
              end: end
            };
          }


          function getPreviousMonthFromPeriod_(periodInfo) {
            const base = periodInfo && periodInfo.start
              ? new Date(periodInfo.start)
              : new Date();

            const year = base.getFullYear();
            const monthIndex = base.getMonth();

            const prevStart = new Date(year, monthIndex - 1, 1);
            const prevEnd = new Date(year, monthIndex, 0);

            const thaiMonths = [
              "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
              "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
            ];

            const prevYear = prevStart.getFullYear();
            const prevMonthIndex = prevStart.getMonth();

            return {
              key: `${prevYear}-${String(prevMonthIndex + 1).padStart(2, "0")}`,
              label: `${thaiMonths[prevMonthIndex]} ${prevYear + 543}`,
              start: prevStart,
              end: prevEnd
            };
          }


          /**
          * ✅ ใช้หลังทดสอบ: คืน ActivePeriod กลับเป็นเดือนปัจจุบันตามวันที่จริง
          * ไม่ Snapshot
          * ไม่ Reset
          * ไม่ลบ TaskHistory
          * ไม่แก้ TaskData
          */
          function resetPeriodControlToCurrentMonth(currentUsername) {
            try {
              const beforePeriod = getActivePeriodInfo();

              const now = new Date();

              const currentPeriod = getCalendarMonthPeriodInfo_(now);
              const previousPeriod = getPreviousMonthFromPeriod_(currentPeriod);

              // ✅ ตั้งรอบที่เปิดให้กรอก = เดือนปัจจุบัน
              setActivePeriodInfo_(currentPeriod, currentUsername || "SYSTEM_REPAIR");

              // ✅ ตั้งรอบล่าสุดที่ปิด = เดือนก่อนหน้า เพื่อให้ flow สมเหตุสมผลหลัง test
              updatePeriodControlValue_(
                "LastClosedPeriodKey",
                previousPeriod.key,
                "รหัสรอบรายงานล่าสุดที่ปิดรอบแล้ว",
                currentUsername || "SYSTEM_REPAIR"
              );

              updatePeriodControlValue_(
                "LastClosedPeriodLabel",
                previousPeriod.label,
                "ชื่อรอบรายงานล่าสุดที่ปิดรอบแล้ว",
                currentUsername || "SYSTEM_REPAIR"
              );

              updatePeriodControlValue_(
                "LastClosedAt",
                now,
                "วันเวลาที่ปรับรอบกลับหลังทดสอบ",
                currentUsername || "SYSTEM_REPAIR"
              );

              updatePeriodControlValue_(
                "LastClosedBy",
                currentUsername || "SYSTEM_REPAIR",
                "ผู้ที่ปรับรอบกลับหลังทดสอบ",
                currentUsername || "SYSTEM_REPAIR"
              );

              // ✅ อัปเดตค่า popup เดิมให้แสดงสอดคล้องกัน
              PropertiesService.getScriptProperties()
                .setProperty("LAST_MONTHLY_CLOSE_AT", now.toISOString());

              PropertiesService.getScriptProperties()
                .setProperty("LAST_MONTHLY_CLOSE_PERIOD", previousPeriod.label);

                safeAppendPeriodActionLog_({
                  action: "RESET_TO_CURRENT_MONTH",
                  actionLabel: "คืนรอบเป็นเดือนปัจจุบัน",
                  beforePeriod: beforePeriod,
                  afterPeriod: currentPeriod,
                  success: true,
                  message: "คืน ActivePeriod กลับเป็นเดือนปัจจุบันหลังทดสอบ",
                  createdBy: currentUsername || "",
                  meta: {
                    previousClosedPeriodKey: previousPeriod.key,
                    previousClosedPeriodLabel: previousPeriod.label
                  }
                });

              return (
                "✅ คืนรอบกลับเป็นเดือนปัจจุบันสำเร็จ\n\n" +
                "📅 เปิดรอบปัจจุบัน: " + currentPeriod.label + "\n" +
                "🗓️ รอบล่าสุดที่ถือว่าปิดแล้ว: " + previousPeriod.label + "\n\n" +
                "หมายเหตุ: คำสั่งนี้ไม่ Snapshot, ไม่ Reset, ไม่ลบข้อมูลเดิม"
              );

            } catch (err) {
              console.error("resetPeriodControlToCurrentMonth ERROR:", err);
              return "❌ คืนรอบไม่สำเร็จ: " + err.message;
            }
          }


          const PERIOD_ACTION_LOG_SHEET = "PeriodActionLog";

          const PERIOD_ACTION_LOG_HEADERS = [
            "LogID",
            "Action",
            "ActionLabel",
            "BeforePeriodKey",
            "BeforePeriodLabel",
            "AfterPeriodKey",
            "AfterPeriodLabel",
            "SnapshotCount",
            "Success",
            "Message",
            "CreatedAt",
            "CreatedBy",
            "MetaJson"
          ];

          function setupPeriodActionLogSheet() {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            let sheet = ss.getSheetByName(PERIOD_ACTION_LOG_SHEET);

            if (!sheet) {
              sheet = ss.insertSheet(PERIOD_ACTION_LOG_SHEET);
              sheet.getRange(1, 1, 1, PERIOD_ACTION_LOG_HEADERS.length)
                .setValues([PERIOD_ACTION_LOG_HEADERS]);
              sheet.getRange(1, 1, 1, PERIOD_ACTION_LOG_HEADERS.length)
                .setFontWeight("bold");
              sheet.setFrozenRows(1);
              sheet.autoResizeColumns(1, PERIOD_ACTION_LOG_HEADERS.length);
              return sheet;
            }

            const lastCol = Math.max(sheet.getLastColumn(), 1);
            let currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
              .map(h => String(h || "").trim());

            const hasHeader = currentHeaders.some(h => h !== "");

            if (!hasHeader) {
              sheet.getRange(1, 1, 1, PERIOD_ACTION_LOG_HEADERS.length)
                .setValues([PERIOD_ACTION_LOG_HEADERS]);
              sheet.getRange(1, 1, 1, PERIOD_ACTION_LOG_HEADERS.length)
                .setFontWeight("bold");
              sheet.setFrozenRows(1);
              sheet.autoResizeColumns(1, PERIOD_ACTION_LOG_HEADERS.length);
              return sheet;
            }

            PERIOD_ACTION_LOG_HEADERS.forEach(header => {
              if (!currentHeaders.includes(header)) {
                const nextCol = sheet.getLastColumn() + 1;
                sheet.getRange(1, nextCol).setValue(header);
                sheet.getRange(1, nextCol).setFontWeight("bold");
                currentHeaders.push(header);
              }
            });

            sheet.setFrozenRows(1);
            return sheet;
          }

          function appendPeriodActionLog_(data) {
            const sheet = setupPeriodActionLogSheet();

            const headers = sheet
              .getRange(1, 1, 1, sheet.getLastColumn())
              .getValues()[0]
              .map(h => String(h || "").trim());

            const before = data.beforePeriod || {};
            const after = data.afterPeriod || {};

            const rowObject = {
              LogID: "PLOG-" + Utilities.getUuid(),
              Action: data.action || "",
              ActionLabel: data.actionLabel || "",
              BeforePeriodKey: before.key || "",
              BeforePeriodLabel: before.label || "",
              AfterPeriodKey: after.key || "",
              AfterPeriodLabel: after.label || "",
              SnapshotCount: data.snapshotCount !== undefined ? data.snapshotCount : "",
              Success: data.success === false ? "N" : "Y",
              Message: data.message || "",
              CreatedAt: new Date(),
              CreatedBy: data.createdBy || "",
              MetaJson: data.meta ? JSON.stringify(data.meta) : ""
            };

            const row = headers.map(header =>
              Object.prototype.hasOwnProperty.call(rowObject, header)
                ? rowObject[header]
                : ""
            );

            sheet.appendRow(row);

            return rowObject.LogID;
          }

          function safeAppendPeriodActionLog_(data) {
            try {
              return appendPeriodActionLog_(data);
            } catch (err) {
              console.error("PeriodActionLog ERROR:", err);
              return null;
            }
          }


          function formatThaiDateShort_(dateValue) {
            if (!dateValue) return "-";

            const d = new Date(dateValue);
            if (isNaN(d.getTime())) return "-";

            const thaiMonths = [
              "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
              "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
            ];

            return d.getDate() + " " + thaiMonths[d.getMonth()] + " " + (d.getFullYear() + 543);
          }


          function getActivePeriodForClient() {
            try {
              const period = getActivePeriodInfo();
              const map = getPeriodControlMap_();

              const lastClosedPeriodKey = String(
                getPeriodControlValue_(map, "LastClosedPeriodKey") || ""
              ).trim();

              const lastClosedPeriodLabel = String(
                getPeriodControlValue_(map, "LastClosedPeriodLabel") || ""
              ).trim();

              const lastClosedAtRaw = getPeriodControlValue_(map, "LastClosedAt");
              const lastClosedBy = String(
                getPeriodControlValue_(map, "LastClosedBy") || ""
              ).trim();

              return {
                success: true,

                key: period.key || "",
                label: period.label || "",

                startText: formatThaiDateShort_(period.start),
                endText: formatThaiDateShort_(period.end),

                startIso: period.start ? new Date(period.start).toISOString() : "",
                endIso: period.end ? new Date(period.end).toISOString() : "",

                lastClosedPeriodKey: lastClosedPeriodKey,
                lastClosedPeriodLabel: lastClosedPeriodLabel,
                lastClosedAt: lastClosedAtRaw ? new Date(lastClosedAtRaw).toISOString() : "",
                lastClosedBy: lastClosedBy
              };

            } catch (err) {
              console.error("getActivePeriodForClient ERROR:", err);

              return {
                success: false,
                message: err.message
              };
            }
          }


          function getPreviousCalendarMonthPeriodInfo_(date) {
            const d = date ? new Date(date) : new Date();

            const year = d.getFullYear();
            const monthIndex = d.getMonth();

            const start = new Date(year, monthIndex - 1, 1);
            const end = new Date(year, monthIndex, 0);

            const thaiMonths = [
              "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
              "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
            ];

            const periodYear = start.getFullYear();
            const periodMonthIndex = start.getMonth();

            return {
              key: `${periodYear}-${String(periodMonthIndex + 1).padStart(2, "0")}`,
              label: `${thaiMonths[periodMonthIndex]} ${periodYear + 543}`,
              start: start,
              end: end
            };
          }


          /**
           * ✅ ใช้ก่อนเปิดให้กรอกวันที่ 1-5 ของเดือน
           * เช่น วันที่ 1-5 มิ.ย. ให้เปิดรอบกรอกของ พ.ค.
           *
           * ไม่ Snapshot
           * ไม่ Reset
           * ไม่แก้ TaskData
           */
          function openPreviousMonthInputPeriod(currentUsername) {
            try {
              requireSuperAdmin_(currentUsername);

              const beforePeriod = getActivePeriodInfo();

              const now = new Date();
              const targetPeriod = getPreviousCalendarMonthPeriodInfo_(now);
              const previousClosedPeriod = getPreviousMonthFromPeriod_(targetPeriod);

              setActivePeriodInfo_(targetPeriod, currentUsername || "SYSTEM");

              updatePeriodControlValue_(
                "LastClosedPeriodKey",
                previousClosedPeriod.key,
                "รหัสรอบรายงานล่าสุดที่ปิดรอบแล้ว",
                currentUsername || "SYSTEM"
              );

              updatePeriodControlValue_(
                "LastClosedPeriodLabel",
                previousClosedPeriod.label,
                "ชื่อรอบรายงานล่าสุดที่ปิดรอบแล้ว",
                currentUsername || "SYSTEM"
              );

              updatePeriodControlValue_(
                "LastClosedAt",
                now,
                "วันเวลาที่เปิดรอบกรอกเดือนก่อนหน้า",
                currentUsername || "SYSTEM"
              );

              updatePeriodControlValue_(
                "LastClosedBy",
                currentUsername || "SYSTEM",
                "ผู้ที่เปิดรอบกรอกเดือนก่อนหน้า",
                currentUsername || "SYSTEM"
              );

              safeAppendPeriodActionLog_({
                action: "OPEN_PREVIOUS_MONTH_INPUT_PERIOD",
                actionLabel: "เปิดรอบกรอกเดือนก่อนหน้า",
                beforePeriod: beforePeriod,
                afterPeriod: targetPeriod,
                success: true,
                message: "เปิด ActivePeriod เป็นเดือนก่อนหน้าเพื่อรับข้อมูลวันที่ 1-5",
                createdBy: currentUsername || "",
                meta: {
                  previousClosedPeriodKey: previousClosedPeriod.key,
                  previousClosedPeriodLabel: previousClosedPeriod.label
                }
              });

              return (
                "✅ เปิดรอบกรอกเดือนก่อนหน้าสำเร็จ\n\n" +
                "📥 รอบที่เปิดให้กรอก: " + targetPeriod.label + "\n" +
                "🗓️ ช่วงข้อมูล: " + formatThaiDateShort_(targetPeriod.start) +
                " - " + formatThaiDateShort_(targetPeriod.end) + "\n" +
                "📌 รอบล่าสุดที่ถือว่าปิดแล้ว: " + previousClosedPeriod.label + "\n\n" +
                "หมายเหตุ: คำสั่งนี้ไม่ Snapshot, ไม่ Reset, ไม่ลบข้อมูลเดิม"
              );

            } catch (err) {
              console.error("openPreviousMonthInputPeriod ERROR:", err);
              return "❌ เปิดรอบกรอกเดือนก่อนหน้าไม่สำเร็จ: " + err.message;
            }
          }


          function normalizePeriodKeyServer_(value) {
            if (value === null || value === undefined || value === "") return "";

            if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
              return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
            }

            if (typeof value === "number" && isFinite(value) && value > 30000 && value < 60000) {
              const base = Date.UTC(1899, 11, 30);
              const d = new Date(base + value * 24 * 60 * 60 * 1000);
              return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
            }

            const s = String(value).trim();

            if (/^\d+(\.\d+)?$/.test(s)) {
              const n = Number(s);
              if (isFinite(n) && n > 30000 && n < 60000) {
                const base = Date.UTC(1899, 11, 30);
                const d = new Date(base + n * 24 * 60 * 60 * 1000);
                return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
              }
            }

            const direct = s.match(/^(\d{4})-(\d{2})$/);
            if (direct) return direct[1] + "-" + direct[2];

            const iso = s.match(/^(\d{4})-(\d{2})-\d{2}/);
            if (iso) return iso[1] + "-" + iso[2];

            const d = new Date(s);
            if (!isNaN(d.getTime())) {
              return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
            }

            return s;
          }


          function repairPeriodKeysToTextOnce() {
            const ss = SpreadsheetApp.getActiveSpreadsheet();

            // ✅ ซ่อม PeriodControl
            const pc = ss.getSheetByName("PeriodControl");
            if (pc) {
              const data = pc.getDataRange().getValues();
              for (let r = 1; r < data.length; r++) {
                const key = String(data[r][0] || "").trim();

                if (key === "ActivePeriodKey" || key === "LastClosedPeriodKey") {
                  const fixed = normalizePeriodKeyServer_(data[r][1]);
                  pc.getRange(r + 1, 2)
                    .setNumberFormat("@")
                    .setValue(fixed);
                }
              }
            }

            // ✅ ซ่อม TaskData
            const taskSheet = ss.getSheetByName("TaskData");
            if (taskSheet) {
              const lastRow = taskSheet.getLastRow();
              const lastCol = taskSheet.getLastColumn();

              if (lastRow >= 2) {
                const headers = taskSheet.getRange(1, 1, 1, lastCol).getValues()[0]
                  .map(h => String(h || "").trim());

                const inputPeriodKeyCol = headers.indexOf("InputPeriodKey");

                if (inputPeriodKeyCol !== -1) {
                  const range = taskSheet.getRange(2, inputPeriodKeyCol + 1, lastRow - 1, 1);
                  const values = range.getValues();

                  const fixedValues = values.map(row => [
                    normalizePeriodKeyServer_(row[0])
                  ]);

                  range.setNumberFormat("@");
                  range.setValues(fixedValues);
                }
              }
            }

            // ✅ ซ่อม TaskHistory เผื่อเอาไปใช้กราฟรายเดือนย้อนหลัง
            const historySheet = ss.getSheetByName("TaskHistory");
            if (historySheet) {
              const lastRow = historySheet.getLastRow();
              const lastCol = historySheet.getLastColumn();

              if (lastRow >= 2) {
                const headers = historySheet.getRange(1, 1, 1, lastCol).getValues()[0]
                  .map(h => String(h || "").trim());

                const inputPeriodKeyCol = headers.indexOf("InputPeriodKey");

                if (inputPeriodKeyCol !== -1) {
                  const range = historySheet.getRange(2, inputPeriodKeyCol + 1, lastRow - 1, 1);
                  const values = range.getValues();

                  const fixedValues = values.map(row => [
                    normalizePeriodKeyServer_(row[0])
                  ]);

                  range.setNumberFormat("@");
                  range.setValues(fixedValues);
                }
              }
            }

            return "✅ ซ่อม PeriodKey เป็นข้อความเรียบร้อยแล้ว";
          }


          function monthlyReportNormalizePeriodKey_(value) {
  if (value === null || value === undefined || value === "") return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
  }

  if (typeof value === "number" && isFinite(value) && value > 30000 && value < 60000) {
    const base = Date.UTC(1899, 11, 30);
    const d = new Date(base + value * 24 * 60 * 60 * 1000);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
  }

  const s = String(value).trim();

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (isFinite(n) && n > 30000 && n < 60000) {
      const base = Date.UTC(1899, 11, 30);
      const d = new Date(base + n * 24 * 60 * 60 * 1000);
      return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
    }
  }

  const direct = s.match(/^(\d{4})-(\d{2})$/);
  if (direct) return direct[1] + "-" + direct[2];

  const iso = s.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (iso) return iso[1] + "-" + iso[2];

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  return s;
}


function monthlyReportText_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}


function monthlyReportCsvCell_(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}


function monthlyReportGetHistoryRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("TaskHistory");

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      headers: [],
      rows: []
    };
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(h => String(h || "").trim());

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastCol)
    .getValues();

  const rows = values.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });

  return {
    headers,
    rows
  };
}


      function monthlyReportPickPeriod_(rows, periodKeyOrLabel) {
        const wantedRaw = monthlyReportText_(periodKeyOrLabel);
        const wantedKey = monthlyReportNormalizePeriodKey_(wantedRaw);

        const periodMap = {};

        rows.forEach(row => {
          const key =
            monthlyReportNormalizePeriodKey_(row.InputPeriodKey) ||
            monthlyReportNormalizePeriodKey_(row.PeriodStart);

          const label =
            monthlyReportText_(row.InputPeriodLabel) ||
            monthlyReportText_(row.PeriodLabel) ||
            key;

          if (!key && !label) return;

          const mapKey = key || label;

          if (!periodMap[mapKey]) {
            periodMap[mapKey] = {
              key: key,
              label: label,
              count: 0
            };
          }

          periodMap[mapKey].count++;
        });

        const periods = Object.keys(periodMap)
          .map(k => periodMap[k])
          .sort((a, b) => String(b.key || b.label).localeCompare(String(a.key || a.label)));

        if (wantedRaw) {
          const found = periods.find(p =>
            p.key === wantedKey ||
            p.key === wantedRaw ||
            p.label === wantedRaw
          );

          if (found) return found;

          return {
            key: wantedKey,
            label: wantedRaw,
            count: 0
          };
        }

        return periods[0] || {
          key: "",
          label: "",
          count: 0
        };
      }


      function monthlyReportMatchesPeriod_(row, targetPeriod) {
        const rowKey =
          monthlyReportNormalizePeriodKey_(row.InputPeriodKey) ||
          monthlyReportNormalizePeriodKey_(row.PeriodStart);

        const rowInputLabel = monthlyReportText_(row.InputPeriodLabel);
        const rowPeriodLabel = monthlyReportText_(row.PeriodLabel);

        if (targetPeriod.key && rowKey) {
          return rowKey === targetPeriod.key;
        }

        if (targetPeriod.label) {
          return rowInputLabel === targetPeriod.label || rowPeriodLabel === targetPeriod.label;
        }

        return false;
      }


      function monthlyReportNormalizeBoolean_(value) {
        if (value === true) return true;
        if (value === false) return false;

        const text = monthlyReportText_(value).toLowerCase();

        if (["true", "yes", "y", "1", "ใช่"].includes(text)) return true;
        if (["false", "no", "n", "0", "ไม่ใช่"].includes(text)) return false;

        return null;
      }


      function monthlyReportCalcPercent_(value, total) {
        const n = Number(value || 0);
        const d = Number(total || 0);

        if (!d) return 0;

        return Math.round((n * 1000) / d) / 10;
      }


      function monthlyReportGetReportingStatus_(rowOrStatus) {
        // ✅ รองรับทั้งส่งเป็น row object และส่งเป็น string
        if (rowOrStatus && typeof rowOrStatus === "object") {
          const row = rowOrStatus;

          const direct = monthlyReportText_(row.ReportingStatus);

          if (direct) {
            return direct;
          }

          const inputStatus = monthlyReportText_(row.InputStatus);
          const achievementStatus = monthlyReportText_(row.AchievementStatus);
          const dueFlag = monthlyReportNormalizeBoolean_(row.IsDueThisPeriod);

          if (
            dueFlag === false ||
            inputStatus === "NotDue" ||
            achievementStatus === "NotDue"
          ) {
            return "NotDue";
          }

          if (inputStatus !== "Submitted") {
            return "NotSubmitted";
          }

          if (
            !achievementStatus ||
            achievementStatus === "NoData" ||
            achievementStatus === "NotEvaluable"
          ) {
            return "NotEvaluable";
          }

          return "Submitted";
        }

        return monthlyReportText_(rowOrStatus);
      }


      function monthlyReportGetAchievementStatus_(row) {
        row = row || {};

        const reportingStatus = monthlyReportGetReportingStatus_(row);

        if (reportingStatus === "NotDue") {
          return "NotDue";
        }

        if (reportingStatus === "NotSubmitted") {
          return "NoData";
        }

        if (reportingStatus === "NotEvaluable") {
          return "NotEvaluable";
        }

        return monthlyReportText_(row.AchievementStatus) || "NoData";
      }


    function monthlyReportBuildGroup_(rows, fieldName) {
      const map = {};

      rows.forEach(row => {
        const groupName = monthlyReportText_(row[fieldName]) || "-";
        const reportingStatus = monthlyReportGetReportingStatus_(row);
        const achievementStatus = monthlyReportGetAchievementStatus_(row);

        if (!map[groupName]) {
          map[groupName] = {
            name: groupName,

            total: 0,
            due: 0,
            notDue: 0,

            submitted: 0,
            notSubmitted: 0,
            notEvaluable: 0,
            sent: 0,

            met: 0,
            notMet: 0,

            submittedPercent: 0,
            sentPercent: 0,
            metPercent: 0
          };
        }

        const item = map[groupName];

        item.total++;

        // ✅ ยังไม่ถึงรอบ แยกออก ไม่ถือว่า “ยังไม่ส่ง”
        if (reportingStatus === "NotDue") {
          item.notDue++;
          return;
        }

        item.due++;

        if (reportingStatus === "NotSubmitted") {
          item.notSubmitted++;
          return;
        }

        if (reportingStatus === "NotEvaluable") {
          item.notEvaluable++;
          item.sent++;
          return;
        }

        // ✅ Submitted = ส่งแล้วและมีผลประเมินได้
        if (reportingStatus === "Submitted") {
          item.submitted++;
          item.sent++;

          if (achievementStatus === "Met") {
            item.met++;
          } else if (achievementStatus === "NotMet") {
            item.notMet++;
          }
        }
      });

      return Object.keys(map)
        .map(key => {
          const item = map[key];

          item.submittedPercent = monthlyReportCalcPercent_(item.submitted, item.due);
          item.sentPercent = monthlyReportCalcPercent_(item.sent, item.due);
          item.metPercent = monthlyReportCalcPercent_(item.met, item.submitted);

          return item;
        })
        .sort((a, b) => {
          if (b.notSubmitted !== a.notSubmitted) return b.notSubmitted - a.notSubmitted;
          if (b.notMet !== a.notMet) return b.notMet - a.notMet;
          if (b.notDue !== a.notDue) return b.notDue - a.notDue;

          return String(a.name).localeCompare(String(b.name), "th");
        });
    }


function monthlyReportBuild_(periodKeyOrLabel, filters) {
  const source = monthlyReportGetHistoryRows_();
  const rows = source.rows;

  const targetPeriod = monthlyReportPickPeriod_(rows, periodKeyOrLabel);

  const periodItems = rows.filter(row =>
    monthlyReportMatchesPeriod_(row, targetPeriod)
  );

  const normalizedFilters = monthlyReportNormalizeFilters_(filters);

  const items = monthlyReportApplyFilters_(periodItems, normalizedFilters);

  const notDue = items.filter(row =>
    monthlyReportGetReportingStatus_(row) === "NotDue"
  );

  const due = items.filter(row =>
    monthlyReportGetReportingStatus_(row) !== "NotDue"
  );

  const submitted = items.filter(row =>
    monthlyReportGetReportingStatus_(row) === "Submitted"
  );

  const notSubmitted = items.filter(row =>
    monthlyReportGetReportingStatus_(row) === "NotSubmitted"
  );

  const notEvaluable = items.filter(row =>
    monthlyReportGetReportingStatus_(row) === "NotEvaluable"
  );

  // ✅ ส่งข้อมูลแล้วทั้งหมด = Submitted + NotEvaluable
  const sent = submitted.concat(notEvaluable);

  const met = submitted.filter(row =>
    monthlyReportGetAchievementStatus_(row) === "Met"
  );

  const notMet = submitted.filter(row =>
    monthlyReportGetAchievementStatus_(row) === "NotMet"
  );

  // ✅ รายการที่ต้องติดตาม
  // ไม่เอา NotDue เข้า follow-up
  const followUpItems = items
    .filter(row => {
      const reportingStatus = monthlyReportGetReportingStatus_(row);
      const achievementStatus = monthlyReportGetAchievementStatus_(row);

      if (reportingStatus === "NotDue") {
        return false;
      }

      return (
        reportingStatus === "NotSubmitted" ||
        reportingStatus === "NotEvaluable" ||
        achievementStatus === "NotMet"
      );
    })
    .map(row => {
      const reportingStatus = monthlyReportGetReportingStatus_(row);
      const achievementStatus = monthlyReportGetAchievementStatus_(row);

      return {
        taskName: monthlyReportText_(row.TaskName),
        department: monthlyReportText_(row.Department),
        workGroup: monthlyReportText_(row.WorkGroup),
        assignee: monthlyReportText_(row.Assignee),

        reportingStatus: reportingStatus,
        inputStatus: monthlyReportText_(row.InputStatus),

        achievementStatus: achievementStatus,
        achievementText: monthlyReportText_(row.AchievementText),

        resultText: reportingStatus === "NotSubmitted" || reportingStatus === "NotDue"
          ? "-"
          : monthlyReportText_(row.ResultText),

        targetText: monthlyReportText_(row.TargetText),
        nextSteps: monthlyReportText_(row.NextSteps),
        challenges: monthlyReportText_(row.Challenges)
      };
    })
    .sort((a, b) => {
      const order = {
        NotSubmitted: 1,
        NotEvaluable: 2,
        Submitted: 3,
        NotDue: 99
      };

      const aOrder = order[a.reportingStatus] || 50;
      const bOrder = order[b.reportingStatus] || 50;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      const aNotMet = a.achievementStatus === "NotMet";
      const bNotMet = b.achievementStatus === "NotMet";

      if (aNotMet !== bNotMet) {
        return aNotMet ? -1 : 1;
      }

      return String(a.taskName).localeCompare(String(b.taskName), "th");
    });

  const total = items.length;

  // ✅ ความครบถ้วนการส่งข้อมูล ต้องคิดจาก sent / due
  // ไม่ใช่ submitted / total
  const sentPercent = monthlyReportCalcPercent_(sent.length, due.length);

  // ✅ เพื่อ backward compatibility ให้ submittedPercent = sentPercent
  // เพราะ UI เดิมอาจใช้ชื่อ submittedPercent อยู่
  const submittedPercent = sentPercent;

  // ✅ อัตราบรรลุ คิดจากรายการที่ประเมินได้เท่านั้น
  const metPercent = monthlyReportCalcPercent_(met.length, submitted.length);

  return {
    success: true,
    periodKey: targetPeriod.key,
    periodLabel: targetPeriod.label,

    filters: normalizedFilters,
    filterDepartmentLabel: monthlyReportFilterLabel_(normalizedFilters.department),
    filterWorkGroupLabel: monthlyReportFilterLabel_(normalizedFilters.workGroup),
    filterSubDepLabel: monthlyReportFilterLabel_(normalizedFilters.subDepLabel),

    total: total,

    due: due.length,
    notDue: notDue.length,

    submitted: submitted.length,
    notSubmitted: notSubmitted.length,
    notEvaluable: notEvaluable.length,

    sent: sent.length,

    met: met.length,
    notMet: notMet.length,

    submittedPercent: submittedPercent,
    sentPercent: sentPercent,
    metPercent: metPercent,

    dueCheck: due.length + notDue.length === total,
    submittedCheck: submitted.length + notSubmitted.length + notEvaluable.length === due.length,

    byDepartment: monthlyReportBuildGroup_(items, "Department"),
    byWorkGroup: monthlyReportBuildGroup_(items, "WorkGroup"),

    followUpItems: followUpItems,

    availablePeriods: monthlyReportPickAvailablePeriods_(rows)
  };
}



function monthlyReportUniqueSorted_(values) {
  const map = {};
  const result = [];

  (Array.isArray(values) ? values : []).forEach(value => {
    const text = monthlyReportText_(value);

    if (!text) return;

    if (!map[text]) {
      map[text] = true;
      result.push(text);
    }
  });

  return result.sort((a, b) =>
    String(a).localeCompare(String(b), "th")
  );
}


/**
 * ✅ ใช้ให้หน้าเว็บดึงตัวเลือก filter จาก TaskHistory ตามรอบที่เลือก
 * รองรับ:
 * - Department = หมวดหมู่
 * - WorkGroup = กลุ่มงาน
 * - SubDepLabel = หมวดย่อย
 */



function monthlyReportIsRawSubDepKey_(value) {
  const text = monthlyReportText_(value);

  if (!text) return false;

  // เช่น HA:CFO,LAB หรือ IR:A,C;HA:MSO,ENV
  return /^[A-Z]+:/.test(text) || text.indexOf(";") !== -1;
}


function monthlyReportSplitSubDepLabels_(value) {
  const text = monthlyReportText_(value);
  if (!text) return [];

  return text
    .split(",")
    .map(v => monthlyReportText_(v))
    .filter(Boolean)
    .filter(v => !monthlyReportIsRawSubDepKey_(v));
}


function monthlyReportIsFullSubDepLabel_(value) {
  const text = monthlyReportText_(value);

  if (!text) return false;
  if (monthlyReportIsRawSubDepKey_(text)) return false;

  // ✅ รับเฉพาะ label แบบอ่านรู้เรื่อง เช่น "ตัวชี้วัดงานคุณภาพ (HA) / ENV"
  return text.indexOf("/") !== -1;
}


function monthlyReportGetSubDepLabelListFromRow_(row) {
  row = row || {};

  const rawSubDep = monthlyReportText_(row.SubDep);
  const oldLabel = monthlyReportText_(row.SubDepLabel);

  const convertedLabels = [];

  // ✅ ใช้ SubDep raw code เป็นหลัก เช่น HA:CFO,LAB
  // แล้วแปลงผ่าน SubDepConfig ให้เป็น FullLabel
  if (rawSubDep && typeof getSubDepLabelFromConfig_ === "function") {
    const converted = getSubDepLabelFromConfig_(rawSubDep, true);

    monthlyReportSplitSubDepLabels_(converted).forEach(label => {
      if (monthlyReportIsFullSubDepLabel_(label)) {
        convertedLabels.push(label);
      }
    });
  }

  // ✅ ถ้าแปลงจาก raw code ได้แล้ว ให้ใช้ชุดนี้เลย
  // ไม่เอา old SubDepLabel สั้น ๆ เช่น ENV, LAB, PTC มาปน
  if (convertedLabels.length) {
    return monthlyReportUniqueSorted_(convertedLabels);
  }

  // ✅ fallback กรณีไม่มี SubDep raw code
  // ใช้เฉพาะ SubDepLabel ที่เป็น full label เท่านั้น
  const fallbackLabels = [];

  monthlyReportSplitSubDepLabels_(oldLabel).forEach(label => {
    if (monthlyReportIsFullSubDepLabel_(label)) {
      fallbackLabels.push(label);
    }
  });

  return monthlyReportUniqueSorted_(fallbackLabels);
}


function monthlyReportRowHasSubDepLabel_(row, targetSubDepLabel) {
  const target = monthlyReportText_(targetSubDepLabel);

  if (!target) return true;

  const labels = monthlyReportGetSubDepLabelListFromRow_(row);

  return labels.indexOf(target) !== -1;
}




function getMonthlyClosedReportFilterOptions(periodKeyOrLabel, filters) {
  try {
    const source = monthlyReportGetPeriodItems_(periodKeyOrLabel);
    const allPeriodItems = source.items || [];

    const normalizedFilters = monthlyReportNormalizeFilters_(filters);

    // ✅ รายการหมวดหมู่: เอาจากทั้งรอบ
    const departmentOptions = monthlyReportUniqueSorted_(
      allPeriodItems.map(row => row.Department)
    );

    // ✅ รายการกลุ่มงาน: กรองตามหมวดหมู่ก่อน ถ้ามีเลือกหมวดหมู่
    const workGroupBaseItems = monthlyReportApplyFilters_(
      allPeriodItems,
      {
        department: normalizedFilters.department
      }
    );

    const workGroupOptions = monthlyReportUniqueSorted_(
      workGroupBaseItems.map(row => row.WorkGroup)
    );

    // ✅ รายการหมวดย่อย: กรองตามหมวดหมู่ + กลุ่มงานก่อน
    const subDepBaseItems = monthlyReportApplyFilters_(
      allPeriodItems,
      {
        department: normalizedFilters.department,
        workGroup: normalizedFilters.workGroup
      }
    );

    let subDepValues = [];

subDepBaseItems.forEach(row => {
  subDepValues = subDepValues.concat(
    monthlyReportGetSubDepLabelListFromRow_(row)
  );
});

const subDepLabelOptions = monthlyReportUniqueSorted_(subDepValues);

    return JSON.stringify({
      success: true,
      periodKey: source.targetPeriod ? source.targetPeriod.key : "",
      periodLabel: source.targetPeriod ? source.targetPeriod.label : "",
      total: allPeriodItems.length,
      filters: normalizedFilters,
      departments: departmentOptions,
      workGroups: workGroupOptions,
      subDepLabels: subDepLabelOptions
    });

  } catch (err) {
    console.error("getMonthlyClosedReportFilterOptions ERROR:", err);

    return JSON.stringify({
      success: false,
      message: err.message
    });
  }
}




function monthlyReportPickAvailablePeriods_(rows) {
  const map = {};

  rows.forEach(row => {
    const key =
      monthlyReportNormalizePeriodKey_(row.InputPeriodKey) ||
      monthlyReportNormalizePeriodKey_(row.PeriodStart);

    const label =
      monthlyReportText_(row.InputPeriodLabel) ||
      monthlyReportText_(row.PeriodLabel) ||
      key;

    if (!key && !label) return;

    const id = key || label;

    if (!map[id]) {
      map[id] = {
        key,
        label,
        count: 0
      };
    }

    map[id].count++;
  });

  return Object.keys(map)
    .map(k => map[k])
    .sort((a, b) => String(b.key || b.label).localeCompare(String(a.key || a.label)));
}


function getMonthlyClosedReport(periodKeyOrLabel, filters) {
  try {
    return JSON.stringify(monthlyReportBuild_(periodKeyOrLabel, filters));
  } catch (err) {
    console.error("getMonthlyClosedReport ERROR:", err);
    return JSON.stringify({
      success: false,
      message: err.message
    });
  }
}



function monthlyReportNormalizeFilterText_(value) {
  return String(value || "").trim();
}


function monthlyReportNormalizeFilters_(filters) {
  filters = filters || {};

  return {
    department: monthlyReportNormalizeFilterText_(filters.department || filters.Department),
    workGroup: monthlyReportNormalizeFilterText_(filters.workGroup || filters.WorkGroup),
    subDepLabel: monthlyReportNormalizeFilterText_(filters.subDepLabel || filters.SubDepLabel)
  };
}


function monthlyReportFilterLabel_(value) {
  const text = monthlyReportNormalizeFilterText_(value);
  return text || "ทั้งหมด";
}


function monthlyReportApplyFilters_(items, filters) {
  const f = monthlyReportNormalizeFilters_(filters);
  const list = Array.isArray(items) ? items : [];

  return list.filter(row => {
    const department = monthlyReportText_(row.Department);
    const workGroup = monthlyReportText_(row.WorkGroup);

    const departmentOk = !f.department || department === f.department;
    const workGroupOk = !f.workGroup || workGroup === f.workGroup;

    // ✅ รองรับหมวดย่อยหลายค่า และไม่เอา GroupKey มาเทียบตรง ๆ
    const subDepLabelOk = monthlyReportRowHasSubDepLabel_(row, f.subDepLabel);

    return departmentOk && workGroupOk && subDepLabelOk;
  });
}


function monthlyReportCsvEscape_(value) {
  const text = value === null || value === undefined
    ? ""
    : String(value);

  return '"' + text.replace(/"/g, '""') + '"';
}


function monthlyReportBuildCsvLine_(values) {
  return values.map(monthlyReportCsvEscape_).join(",");
}


function monthlyReportResultTextForExport_(row) {
  const reportingStatus = monthlyReportGetReportingStatus_(row);

  if (reportingStatus === "NotDue") {
    return "-";
  }

  if (reportingStatus === "NotSubmitted") {
    return "-";
  }

  return monthlyReportText_(row.ResultText) || "-";
}


function monthlyReportFollowUpReasonFromRow_(row) {
  const reportingStatus = monthlyReportGetReportingStatus_(row);
  const achievementStatus = monthlyReportGetAchievementStatus_(row);

  if (reportingStatus === "NotDue") {
    return "";
  }

  if (reportingStatus === "NotSubmitted") {
    return "ถึงรอบรายงานแล้ว แต่ยังไม่ส่งข้อมูล";
  }

  if (reportingStatus === "NotEvaluable") {
    return "ส่งข้อมูลแล้ว แต่ยังประเมินไม่ได้";
  }

  if (achievementStatus === "NotMet") {
    return monthlyReportText_(row.NextSteps) ||
      monthlyReportText_(row.Challenges) ||
      monthlyReportText_(row.AchievementText) ||
      "ติดตามแนวทางแก้ไขผลการดำเนินงาน";
  }

  return "";
}


function monthlyReportGetRowsForExport_(periodKeyOrLabel, filters) {
  const source = monthlyReportGetHistoryRows_();
  const rows = source.rows;

  const targetPeriod = monthlyReportPickPeriod_(rows, periodKeyOrLabel);

  const periodItems = rows.filter(row =>
    monthlyReportMatchesPeriod_(row, targetPeriod)
  );

  const normalizedFilters = monthlyReportNormalizeFilters_(filters);

  const items = monthlyReportApplyFilters_(periodItems, normalizedFilters);

  return {
    rows: items,
    targetPeriod: targetPeriod,
    filters: normalizedFilters
  };
}






  function monthlyReportExecutiveStatusText_(report) {
    report = report || {};

    const due = Number(report.due || 0);
    const sent = Number(report.sent || 0);
    const notSubmitted = Number(report.notSubmitted || 0);
    const notEvaluable = Number(report.notEvaluable || 0);
    const notMet = Number(report.notMet || 0);
    const notDue = Number(report.notDue || 0);

    if (!due) {
      return "รอบนี้ยังไม่มีรายการที่ถึงรอบรายงาน";
    }

    if (sent === 0 && notSubmitted > 0) {
      return "ยังไม่มีการส่งข้อมูลในรายการที่ถึงรอบ";
    }

    if (notSubmitted > 0 || notEvaluable > 0 || notMet > 0) {
      return "มีประเด็นที่ต้องติดตามก่อนปิดรอบ";
    }

    if (notDue > 0) {
      return "ข้อมูลในรายการที่ถึงรอบครบถ้วนแล้ว และมีบางรายการที่ยังไม่ถึงรอบรายงาน";
    }

    return "ข้อมูลครบถ้วนในรอบรายงานนี้";
  }

  function monthlyReportExecutiveConclusionText_(report) {
    report = report || {};

    const total = Number(report.total || 0);
    const due = Number(report.due || 0);
    const notDue = Number(report.notDue || 0);
    const sent = Number(report.sent || 0);
    const notSubmitted = Number(report.notSubmitted || 0);
    const notEvaluable = Number(report.notEvaluable || 0);
    const met = Number(report.met || 0);
    const notMet = Number(report.notMet || 0);
    const followUpCount = Array.isArray(report.followUpItems)
      ? report.followUpItems.length
      : 0;

    if (!total) {
      return "ไม่พบข้อมูลตัวชี้วัดในรอบรายงานนี้";
    }

    if (!due) {
      return "มีตัวชี้วัดทั้งหมด " + total +
        " รายการ แต่ยังไม่มีรายการที่ถึงรอบรายงานในเดือนนี้";
    }

    return "มีตัวชี้วัดทั้งหมด " + total +
      " รายการ | ถึงรอบรายงาน " + due +
      " รายการ | ส่งข้อมูลแล้ว " + sent +
      " รายการ | ถึงรอบแต่ยังไม่ส่ง " + notSubmitted +
      " รายการ | ส่งแล้วแต่ยังประเมินไม่ได้ " + notEvaluable +
      " รายการ | บรรลุเป้าหมาย " + met +
      " รายการ | ไม่บรรลุเป้าหมาย " + notMet +
      " รายการ | ยังไม่ถึงรอบรายงาน " + notDue +
      " รายการ | รายการที่ควรติดตาม " + followUpCount + " รายการ";
  }

  function monthlyReportExecutiveActionText_(report) {
    report = report || {};

    const notSubmitted = Number(report.notSubmitted || 0);
    const notEvaluable = Number(report.notEvaluable || 0);
    const notMet = Number(report.notMet || 0);
    const notDue = Number(report.notDue || 0);

    const actions = [];

    if (notSubmitted > 0) {
      actions.push("ติดตามผู้รับผิดชอบให้ส่งข้อมูล " + notSubmitted + " รายการที่ถึงรอบแล้ว");
    }

    if (notEvaluable > 0) {
      actions.push("ตรวจสอบเงื่อนไขหรือข้อมูลประกอบของ " + notEvaluable + " รายการที่ยังประเมินไม่ได้");
    }

    if (notMet > 0) {
      actions.push("วิเคราะห์สาเหตุและแผนแก้ไขของ " + notMet + " รายการที่ไม่บรรลุเป้าหมาย");
    }

    if (!actions.length) {
      return "ยังไม่พบประเด็นเร่งด่วนที่ต้องติดตามในรอบนี้";
    }

    return actions.join(" | ") +
      " | รายการที่ยังไม่ถึงรอบรายงาน " + notDue +
      " รายการ ไม่นับเป็นงานค้างส่ง";
  }

  function monthlyReportExecutiveCountingNote_(report) {
    report = report || {};

    return "การนับรายการค้างส่งคิดเฉพาะรายการที่ถึงรอบรายงานแล้วเท่านั้น " +
      "รายการที่ยังไม่ถึงรอบรายงานจะอยู่ในข้อมูลทั้งหมด แต่ไม่ถูกนับเป็น Follow-up หรือรายการค้างส่ง";
  }



      function exportMonthlyClosedReportCsv(periodKeyOrLabel, exportMode, filters) {
        // ✅ รองรับทั้งรูปแบบเก่า exportMonthlyClosedReportCsv(periodKey, filters)
        // และรูปแบบใหม่ exportMonthlyClosedReportCsv(periodKey, exportMode, filters)
        if (typeof exportMode === "object" && filters === undefined) {
          filters = exportMode;
          exportMode = "executive";
        }

        exportMode = String(exportMode || "executive").trim();
        filters = filters || {};

        const report = monthlyReportBuild_(periodKeyOrLabel, filters);
        const exportData = monthlyReportGetRowsForExport_(periodKeyOrLabel, filters);

        const rows = exportData.rows || [];
        const followUpCount = Array.isArray(report.followUpItems)
          ? report.followUpItems.length
          : 0;

        const lines = [];

        // =========================
        // 1) Report Header
        // =========================
        lines.push(monthlyReportBuildCsvLine_(["รายงานหลังปิดรอบ"]));
        lines.push(monthlyReportBuildCsvLine_(["รอบรายงาน", report.periodLabel]));
        lines.push(monthlyReportBuildCsvLine_(["รหัสรอบ", report.periodKey]));
        lines.push(monthlyReportBuildCsvLine_(["รูปแบบรายงาน", "สำหรับผู้บริหาร"]));
        lines.push(monthlyReportBuildCsvLine_([""]));

        // =========================
        // 2) Executive Summary
        // =========================
        lines.push(monthlyReportBuildCsvLine_(["บทสรุปสำหรับผู้บริหาร"]));
        lines.push(monthlyReportBuildCsvLine_(["หัวข้อ", "รายละเอียด"]));

        lines.push(monthlyReportBuildCsvLine_([
          "สถานะภาพรวม",
          monthlyReportExecutiveStatusText_(report)
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ข้อสรุป",
          monthlyReportExecutiveConclusionText_(report)
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "สิ่งที่ควรติดตาม",
          monthlyReportExecutiveActionText_(report)
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ข้อย้ำการนับ",
          monthlyReportExecutiveCountingNote_(report)
        ]));

        lines.push(monthlyReportBuildCsvLine_([""]));

        // =========================
        // 3) Counting Explanation
        // =========================
        lines.push(monthlyReportBuildCsvLine_(["คำอธิบายการนับตัวเลข"]));
        lines.push(monthlyReportBuildCsvLine_(["รายการ", "ความหมายสำหรับผู้บริหาร"]));

        lines.push(monthlyReportBuildCsvLine_([
          "ตัวชี้วัดทั้งหมด",
          "ตัวชี้วัดทั้งหมดที่อยู่ในข้อมูล snapshot ของรอบรายงานนี้"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ถึงรอบรายงาน",
          "ตัวชี้วัดที่ต้องส่งข้อมูลในรอบนี้ ใช้เป็นฐานคำนวณความครบถ้วน"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ยังไม่ถึงรอบรายงาน",
          "ตัวชี้วัดที่ยังไม่ต้องส่งในรอบนี้ จึงไม่ถือเป็นงานค้างส่ง"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ส่งข้อมูลแล้ว",
          "รายการที่ผู้รับผิดชอบส่งข้อมูลแล้ว รวมรายการที่ส่งแล้วแต่ยังประเมินไม่ได้"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ถึงรอบแต่ยังไม่ส่ง",
          "รายการที่ถึงรอบรายงานแล้ว แต่ยังไม่มีการส่งข้อมูล เป็นรายการที่ควรติดตาม"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "รายการที่ควรติดตาม",
          "รวมรายการที่ถึงรอบแต่ยังไม่ส่ง ส่งแล้วแต่ยังประเมินไม่ได้ หรือไม่บรรลุเป้าหมาย โดยไม่รวมรายการที่ยังไม่ถึงรอบรายงาน"
        ]));

        lines.push(monthlyReportBuildCsvLine_([""]));

        // =========================
        // 4) Summary
        // =========================
        lines.push(monthlyReportBuildCsvLine_(["สรุปภาพรวม"]));
        lines.push(monthlyReportBuildCsvLine_(["รายการ", "จำนวน", "คำอธิบาย"]));

        lines.push(monthlyReportBuildCsvLine_([
          "ตัวชี้วัดทั้งหมด",
          report.total,
          "ทั้งหมดในรอบรายงานนี้"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ถึงรอบรายงาน",
          report.due,
          "รายการที่ต้องส่งข้อมูลในรอบนี้"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ยังไม่ถึงรอบรายงาน",
          report.notDue,
          "ไม่ถือเป็นงานค้างส่ง และไม่เข้า Follow-up"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ส่งข้อมูลแล้ว",
          report.sent,
          "รายการที่ส่งข้อมูลแล้ว รวมรายการที่ส่งแล้วแต่ยังประเมินไม่ได้"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ถึงรอบแต่ยังไม่ส่ง",
          report.notSubmitted,
          "รายการที่ต้องติดตามให้ส่งข้อมูล"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ส่งแล้วแต่ยังประเมินไม่ได้",
          report.notEvaluable,
          "ควรตรวจสอบข้อมูลหรือเงื่อนไขการประเมิน"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "บรรลุเป้าหมาย",
          report.met,
          "คิดเฉพาะรายการที่ส่งข้อมูลและประเมินผลได้"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "ไม่บรรลุเป้าหมาย",
          report.notMet,
          "ควรติดตามสาเหตุและแผนแก้ไข"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "รายการที่ควรติดตาม",
          followUpCount,
          "ไม่รวมรายการที่ยังไม่ถึงรอบรายงาน"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "อัตราส่งข้อมูล",
          report.sentPercent + "%",
          "คิดจาก ส่งข้อมูลแล้ว / รายการที่ถึงรอบรายงาน"
        ]));

        lines.push(monthlyReportBuildCsvLine_([
          "อัตราบรรลุเป้าหมาย",
          report.metPercent + "%",
          "คิดจาก บรรลุเป้าหมาย / รายการที่ประเมินผลได้"
        ]));

        lines.push(monthlyReportBuildCsvLine_([""]));

        // =========================
        // 5) Department Summary
        // =========================
        lines.push(monthlyReportBuildCsvLine_(["สรุปตามหมวดหมู่"]));
        lines.push(monthlyReportBuildCsvLine_([
          "หมวดหมู่",
          "ทั้งหมด",
          "ถึงรอบ",
          "ยังไม่ถึงรอบ",
          "ส่งข้อมูลแล้ว",
          "ถึงรอบแต่ยังไม่ส่ง",
          "ส่งแล้วแต่ยังประเมินไม่ได้",
          "บรรลุ",
          "ไม่บรรลุ",
          "อัตราส่งข้อมูล",
          "อัตราบรรลุ",
          "ข้อสรุป"
        ]));

        (report.byDepartment || []).forEach(item => {
          const due = Number(item.due || 0);
          const notSubmitted = Number(item.notSubmitted || 0);
          const notDue = Number(item.notDue || 0);

          let conclusion = "ไม่มีรายการที่ถึงรอบ";
          if (due > 0 && notSubmitted > 0) {
            conclusion = "มีรายการถึงรอบแต่ยังไม่ส่ง " + notSubmitted + " รายการ";
          } else if (due > 0) {
            conclusion = "รายการที่ถึงรอบส่งครบแล้ว";
          }

          if (notDue > 0) {
            conclusion += " | ยังไม่ถึงรอบ " + notDue + " รายการ";
          }

          lines.push(monthlyReportBuildCsvLine_([
            item.name,
            item.total,
            item.due,
            item.notDue,
            item.sent,
            item.notSubmitted,
            item.notEvaluable,
            item.met,
            item.notMet,
            item.sentPercent + "%",
            item.metPercent + "%",
            conclusion
          ]));
        });

        lines.push(monthlyReportBuildCsvLine_([""]));

        // =========================
        // 6) WorkGroup Summary
        // =========================
        lines.push(monthlyReportBuildCsvLine_(["สรุปตามกลุ่มงาน"]));
        lines.push(monthlyReportBuildCsvLine_([
          "กลุ่มงาน",
          "ทั้งหมด",
          "ถึงรอบ",
          "ยังไม่ถึงรอบ",
          "ส่งข้อมูลแล้ว",
          "ถึงรอบแต่ยังไม่ส่ง",
          "ส่งแล้วแต่ยังประเมินไม่ได้",
          "บรรลุ",
          "ไม่บรรลุ",
          "อัตราส่งข้อมูล",
          "อัตราบรรลุ",
          "ข้อสรุป"
        ]));

        (report.byWorkGroup || []).forEach(item => {
          const due = Number(item.due || 0);
          const notSubmitted = Number(item.notSubmitted || 0);
          const notDue = Number(item.notDue || 0);

          let conclusion = "ไม่มีรายการที่ถึงรอบ";
          if (due > 0 && notSubmitted > 0) {
            conclusion = "มีรายการถึงรอบแต่ยังไม่ส่ง " + notSubmitted + " รายการ";
          } else if (due > 0) {
            conclusion = "รายการที่ถึงรอบส่งครบแล้ว";
          }

          if (notDue > 0) {
            conclusion += " | ยังไม่ถึงรอบ " + notDue + " รายการ";
          }

          lines.push(monthlyReportBuildCsvLine_([
            item.name,
            item.total,
            item.due,
            item.notDue,
            item.sent,
            item.notSubmitted,
            item.notEvaluable,
            item.met,
            item.notMet,
            item.sentPercent + "%",
            item.metPercent + "%",
            conclusion
          ]));
        });

        lines.push(monthlyReportBuildCsvLine_([""]));

        // =========================
        // 7) Follow-up Items
        // =========================
        lines.push(monthlyReportBuildCsvLine_(["รายการที่ควรติดตาม"]));
        lines.push(monthlyReportBuildCsvLine_([
          "ชื่อตัวชี้วัด",
          "หมวดหมู่",
          "กลุ่มงาน",
          "ผู้รับผิดชอบ",
          "สถานะการรายงาน",
          "ผลประเมิน",
          "ผลลัพธ์",
          "เป้าหมาย",
          "เหตุผลที่ต้องติดตาม"
        ]));

        if (!(report.followUpItems || []).length) {
          lines.push(monthlyReportBuildCsvLine_([
            "ไม่พบรายการที่ควรติดตามในรอบนี้",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "รายการที่ยังไม่ถึงรอบรายงานไม่ถูกนับเป็น Follow-up"
          ]));
        } else {
          (report.followUpItems || []).forEach(item => {
            lines.push(monthlyReportBuildCsvLine_([
              item.taskName,
              item.department,
              item.workGroup,
              item.assignee,
              monthlyReportInputStatusThai_(item.reportingStatus),
              monthlyReportAchievementStatusThai_(item.achievementStatus),
              item.resultText || "-",
              item.targetText || "-",
              monthlyReportFollowUpReason_(item)
            ]));
          });
        }

        lines.push(monthlyReportBuildCsvLine_([""]));

        // =========================
        // 8) Raw Data รายตัวชี้วัด
        // =========================
        lines.push(monthlyReportBuildCsvLine_(["ข้อมูลรายตัวชี้วัดทั้งหมด"]));
        lines.push(monthlyReportBuildCsvLine_([
          "ชื่อตัวชี้วัด",
          "หมวดหมู่",
          "กลุ่มงาน",
          "หน่วยย่อย",
          "ผู้รับผิดชอบ",
          "สถานะการรายงาน",
          "ผลประเมิน",
          "ผลลัพธ์",
          "เป้าหมาย",
          "รอบรายงาน",
          "IsDueThisPeriod",
          "ReportingStatus",
          "หมายเหตุ/เหตุผลติดตาม"
        ]));

        rows.forEach(row => {
          const reportingStatus = monthlyReportGetReportingStatus_(row);
          const achievementStatus = monthlyReportGetAchievementStatus_(row);

          lines.push(monthlyReportBuildCsvLine_([
            monthlyReportText_(row.TaskName),
            monthlyReportText_(row.Department),
            monthlyReportText_(row.WorkGroup),
            monthlyReportText_(row.SubDepLabel || row.SubDep),
            monthlyReportText_(row.Assignee),
            monthlyReportInputStatusThai_(row),
            monthlyReportAchievementStatusThai_(achievementStatus),
            monthlyReportResultTextForExport_(row),
            monthlyReportText_(row.TargetText),
            monthlyReportText_(row.InputPeriodLabel || row.PeriodLabel),
            monthlyReportText_(row.IsDueThisPeriod),
            reportingStatus,
            monthlyReportFollowUpReasonFromRow_(row)
          ]));
        });

        const csvContent = "\uFEFF" + lines.join("\n");

        const safePeriod = String(report.periodLabel || report.periodKey || "monthly-report")
          .replace(/[\\/:*?"<>|]/g, "-");

        const fileName = "รายงานหลังปิดรอบ_" + safePeriod + ".csv";

        return {
          success: true,
          fileName: fileName,
          mimeType: "text/csv;charset=utf-8",

          // ✅ รองรับ frontend ทุกเวอร์ชัน
          csv: csvContent,
          content: csvContent,
          csvContent: csvContent,

          report: {
            periodKey: report.periodKey,
            periodLabel: report.periodLabel,
            total: report.total,
            due: report.due,
            notDue: report.notDue,
            submitted: report.submitted,
            notSubmitted: report.notSubmitted,
            notEvaluable: report.notEvaluable,
            sent: report.sent,
            met: report.met,
            notMet: report.notMet,
            dueCheck: report.dueCheck,
            submittedCheck: report.submittedCheck,
            followUpCount: followUpCount
          }
        };
      }

function monthlyReportInputStatusThai_(rowOrStatus) {
  const s = monthlyReportGetReportingStatus_(rowOrStatus);

  if (s === "Submitted") return "ส่งข้อมูลแล้ว";
  if (s === "NotSubmitted") return "ถึงรอบแต่ยังไม่ส่ง";
  if (s === "NotDue") return "ยังไม่ถึงรอบรายงาน";
  if (s === "NotEvaluable") return "ส่งแล้ว/รอประเมิน";

  return s || "ไม่ทราบสถานะ";
}


function monthlyReportAchievementStatusThai_(status) {
  const s = monthlyReportText_(status);

  if (s === "Met") return "บรรลุเป้าหมาย";
  if (s === "NotMet") return "ไม่บรรลุเป้าหมาย";
  if (s === "NotDue") return "ยังไม่ถึงรอบรายงาน";
  if (s === "NoData") return "ไม่มีข้อมูล";
  if (s === "NotEvaluable") return "ยังประเมินไม่ได้";

  return s || "ไม่มีข้อมูล";
}


function monthlyReportDateTimeText_(value) {
  if (!value) return "";

  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
}


function monthlyReportPercentText_(value) {
  const n = Number(value || 0);

  if (!isFinite(n) || n === 0) return "0%";
  if (Number.isInteger(n)) return n + "%";

  return n.toFixed(1).replace(".0", "") + "%";
}


function monthlyReportGetPeriodItems_(periodKeyOrLabel) {
  const source = monthlyReportGetHistoryRows_();
  const rows = source.rows || [];

  const targetPeriod = monthlyReportPickPeriod_(rows, periodKeyOrLabel);

  const items = rows.filter(row =>
    monthlyReportMatchesPeriod_(row, targetPeriod)
  );

  return {
    targetPeriod,
    items
  };
}


function monthlyReportGetSnapshotMeta_(items) {
  const list = Array.isArray(items) ? items : [];

  let snapshotRunID = "";
  let snapshotAt = "";
  let snapshotBy = "";

  for (let i = 0; i < list.length; i++) {
    if (!snapshotRunID && list[i].SnapshotRunID) {
      snapshotRunID = monthlyReportText_(list[i].SnapshotRunID);
    }

    if (!snapshotAt && list[i].SnapshotAt) {
      snapshotAt = list[i].SnapshotAt;
    }

    if (!snapshotBy && list[i].SnapshotBy) {
      snapshotBy = monthlyReportText_(list[i].SnapshotBy);
    }

    if (snapshotRunID && snapshotAt && snapshotBy) break;
  }

  return {
    snapshotRunID,
    snapshotAt,
    snapshotBy
  };
}


function monthlyReportFollowUpReason_(item) {
  const reportingStatus = monthlyReportText_(item.reportingStatus || item.inputStatus);
  const achievementStatus = monthlyReportText_(item.achievementStatus);

  if (reportingStatus === "NotDue") {
    return "";
  }

  if (reportingStatus === "NotSubmitted") {
    return "ถึงรอบรายงานแล้ว แต่ยังไม่ส่งข้อมูล";
  }

  if (reportingStatus === "NotEvaluable") {
    return "ส่งข้อมูลแล้ว แต่ยังประเมินไม่ได้ ควรตรวจสอบเงื่อนไขการประเมิน";
  }

  if (achievementStatus === "NotMet") {
    return item.nextSteps ||
      item.challenges ||
      item.achievementText ||
      "ติดตามแนวทางแก้ไขผลการดำเนินงาน";
  }

  return "";
}


function monthlyReportRowValue_(row, fieldName) {
  return monthlyReportText_(row[fieldName]);
}

function exportMonthlyClosedRawDataCsv(periodKeyOrLabel, filters) {
  return exportMonthlyClosedReportCsv(periodKeyOrLabel, "raw", filters);
}




function testStep13MonthlyClosedReportExportCsv() {
  const result = exportMonthlyClosedReportCsv("", {});

  const csv = result.csvContent || result.content || "";

  const checks = {
    success: result.success,
    fileName: result.fileName,

    report: result.report,

    hasNotDueText: csv.indexOf("ยังไม่ถึงรอบรายงาน") !== -1,
    hasNotSubmittedText: csv.indexOf("ถึงรอบแต่ยังไม่ส่ง") !== -1,
    hasOldWrongText: csv.indexOf("ยังไม่ส่งข้อมูล") !== -1,

    hasRawReportingStatus: csv.indexOf("ReportingStatus") !== -1,
    hasIsDueThisPeriod: csv.indexOf("IsDueThisPeriod") !== -1,

    notDueInFollowUpShouldBeZero: result.report
      ? result.report.followUpCount === result.report.notSubmitted + result.report.notEvaluable + result.report.notMet
      : false,

    csvLength: csv.length,
    previewFirst1000Chars: csv.slice(0, 1000)
  };

  Logger.log(JSON.stringify(checks, null, 2));

  return checks;
}





        function getClosePeriodDataQualityPreview() {
          const dq = validateDataQualityBeforeClosePeriod_();

          return {
            success: true,

            dataQualitySuccess: dq.success,
            canClose: dq.success,

            periodKey: dq.periodKey,
            periodLabel: dq.periodLabel,
            totalRows: dq.totalRows,

            summary: dq.summary || {},

            criticalCount: dq.criticalCount || 0,
            warningCount: dq.warningCount || 0,

            issues: (dq.issues || []).map(normalizeDQIssueForClient_),
            criticalIssues: (dq.criticalIssues || []).map(normalizeDQIssueForClient_),
            warningIssues: (dq.warningIssues || []).map(normalizeDQIssueForClient_)
          };
        }


        function normalizeDQIssueForClient_(issue) {
          issue = issue || {};

          return {
            level: issue.level || "",
            rowNumber: issue.rowNumber || issue.row || "",
            taskId: issue.taskId || issue.ID || "",
            taskName: issue.taskName || issue.Task || issue.task || "",
            field: issue.field || issue.column || "",
            message: issue.message || issue.detail || "",
            assignee: issue.assignee || issue.Assignee || "",
            department: issue.department || issue.Department || "",
            workGroup: issue.workGroup || issue.WorkGroup || ""
          };
        }


        function testStep14DataQualityPreviewForUi() {
          const result = getClosePeriodDataQualityPreview();

          Logger.log(JSON.stringify(result, null, 2));

          return result;
        }
function testMonthlyClosedReportFilterOptions() {
  const result = getMonthlyClosedReportFilterOptions("2026-06", {
    department: "",
    workGroup: "",
    subDepLabel: ""
  });

  Logger.log(result);
  return result;
}


    function getMonthlyClosedReportFilterMap(periodKeyOrLabel) {
      try {
        const source = monthlyReportGetPeriodItems_(periodKeyOrLabel);
        const allPeriodItems = source.items || [];

        const rows = [];

        allPeriodItems.forEach(row => {
          const department = monthlyReportText_(row.Department);
          const workGroup = monthlyReportText_(row.WorkGroup);
          const subDepLabels = monthlyReportGetSubDepLabelListFromRow_(row);

          rows.push({
            department: department,
            workGroup: workGroup,
            subDepLabels: subDepLabels
          });
        });

        const departments = monthlyReportUniqueSorted_(
          rows.map(r => r.department)
        );

        const workGroups = monthlyReportUniqueSorted_(
          rows.map(r => r.workGroup)
        );

        let subDepValues = [];

        rows.forEach(r => {
          subDepValues = subDepValues.concat(r.subDepLabels || []);
        });

        const subDepLabels = monthlyReportUniqueSorted_(subDepValues);

        return JSON.stringify({
          success: true,
          periodKey: source.targetPeriod ? source.targetPeriod.key : "",
          periodLabel: source.targetPeriod ? source.targetPeriod.label : "",
          total: allPeriodItems.length,
          departments: departments,
          workGroups: workGroups,
          subDepLabels: subDepLabels,
          rows: rows
        });

      } catch (err) {
        console.error("getMonthlyClosedReportFilterMap ERROR:", err);

        return JSON.stringify({
          success: false,
          message: err.message
        });
      }
    }




    function countTaskHistoryRowsBySnapshotRunId_(snapshotRunId) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("TaskHistory");

      if (!sheet || sheet.getLastRow() < 2) return 0;

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();

      const headers = sheet
        .getRange(1, 1, 1, lastCol)
        .getValues()[0]
        .map(h => String(h || "").trim());

      const snapshotCol = headers.indexOf("SnapshotRunID");

      if (snapshotCol === -1) {
        throw new Error("ไม่พบคอลัมน์ SnapshotRunID ใน TaskHistory");
      }

      const values = sheet
        .getRange(2, 1, lastRow - 1, lastCol)
        .getValues();

      return values.filter(row =>
        String(row[snapshotCol] || "").trim() === String(snapshotRunId || "").trim()
      ).length;
    }


      function getSnapshotRunQualitySummary_(snapshotRunId) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("TaskHistory");

      if (!sheet || sheet.getLastRow() < 2) {
        return {
          success: false,
          message: "ไม่พบข้อมูล TaskHistory สำหรับตรวจ Snapshot"
        };
      }

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();

      const values = sheet
        .getRange(1, 1, lastRow, lastCol)
        .getValues();

      const headers = values[0].map(function(h) {
        return String(h || "").trim();
      });

      const idx = {
        snapshotRunId: headers.indexOf("SnapshotRunID"),
        taskId: headers.indexOf("TaskID"),
        isDue: headers.indexOf("IsDueThisPeriod"),
        inputStatus: headers.indexOf("InputStatus"),
        reportingStatus: headers.indexOf("ReportingStatus"),
        achievementStatus: headers.indexOf("AchievementStatus")
      };

      if (idx.snapshotRunId === -1) {
        throw new Error("TaskHistory ไม่มีคอลัมน์ SnapshotRunID");
      }

      if (idx.reportingStatus === -1) {
        throw new Error("TaskHistory ไม่มีคอลัมน์ ReportingStatus");
      }

      const rows = values.slice(1)
        .map(function(row, index) {
          return {
            row: row,
            sheetRowNumber: index + 2
          };
        })
        .filter(function(item) {
          return String(item.row[idx.snapshotRunId] || "").trim() === String(snapshotRunId || "").trim();
        });

      const summary = {
        success: true,
        snapshotRunId: snapshotRunId,
        total: rows.length,
        due: 0,
        notDue: 0,
        submitted: 0,
        notSubmitted: 0,
        notEvaluable: 0,
        blankReportingStatus: 0,
        inconsistentRows: []
      };

      rows.forEach(function(item) {
        const row = item.row;
        const sheetRowNumber = item.sheetRowNumber;

        const isDueText = idx.isDue !== -1
          ? String(row[idx.isDue] || "").trim().toLowerCase()
          : "";

        const isDue =
          isDueText === "true" ||
          isDueText === "yes" ||
          isDueText === "1" ||
          row[idx.isDue] === true;

        const inputStatus = idx.inputStatus !== -1
          ? String(row[idx.inputStatus] || "").trim()
          : "";

        const reportingStatus = String(row[idx.reportingStatus] || "").trim();

        if (!reportingStatus) {
          summary.blankReportingStatus++;
          summary.inconsistentRows.push({
            rowNumber: sheetRowNumber,
            taskId: idx.taskId !== -1 ? row[idx.taskId] : "",
            issue: "ReportingStatus ว่าง"
          });
          return;
        }

        if (reportingStatus === "NotDue") {
          summary.notDue++;

          if (isDue) {
            summary.inconsistentRows.push({
              rowNumber: sheetRowNumber,
              taskId: idx.taskId !== -1 ? row[idx.taskId] : "",
              issue: "ReportingStatus เป็น NotDue แต่ IsDueThisPeriod เป็น true"
            });
          }

          return;
        }

        summary.due++;

        if (reportingStatus === "Submitted") {
          summary.submitted++;

          if (inputStatus !== "Submitted") {
            summary.inconsistentRows.push({
              rowNumber: sheetRowNumber,
              taskId: idx.taskId !== -1 ? row[idx.taskId] : "",
              issue: "ReportingStatus เป็น Submitted แต่ InputStatus ไม่ใช่ Submitted"
            });
          }

          return;
        }

        if (reportingStatus === "NotSubmitted") {
          summary.notSubmitted++;

          if (inputStatus === "Submitted") {
            summary.inconsistentRows.push({
              rowNumber: sheetRowNumber,
              taskId: idx.taskId !== -1 ? row[idx.taskId] : "",
              issue: "ReportingStatus เป็น NotSubmitted แต่ InputStatus เป็น Submitted"
            });
          }

          return;
        }

        if (reportingStatus === "NotEvaluable") {
          summary.notEvaluable++;
          return;
        }
      });

      const dueCheck =
        summary.due + summary.notDue === summary.total;

      const submittedCheck =
        summary.submitted +
        summary.notSubmitted +
        summary.notEvaluable === summary.due;

      if (
        !dueCheck ||
        !submittedCheck ||
        summary.blankReportingStatus > 0 ||
        summary.inconsistentRows.length > 0
      ) {
        summary.success = false;
        summary.message =
          "Snapshot QA ไม่ผ่าน" +
          "\nรวมทั้งหมด: " + summary.total +
          "\ndue + notDue: " + (summary.due + summary.notDue) +
          "\nsubmitted + notSubmitted + notEvaluable: " +
          (summary.submitted + summary.notSubmitted + summary.notEvaluable) +
          "\ndue: " + summary.due +
          "\nReportingStatus ว่าง: " + summary.blankReportingStatus +
          "\nแถวผิดปกติ: " + summary.inconsistentRows.length;
      } else {
        summary.message = "Snapshot QA ผ่าน";
      }

      return summary;
    }

    function deleteTaskHistoryRowsBySnapshotRunId_(snapshotRunId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("TaskHistory");

  if (!sheet || sheet.getLastRow() < 2) {
    return 0;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function(h) {
      return String(h || "").trim();
    });

  const snapshotCol = headers.indexOf("SnapshotRunID");

  if (snapshotCol === -1) {
    throw new Error("ไม่พบคอลัมน์ SnapshotRunID ใน TaskHistory");
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, lastCol)
    .getValues();

  const rowsToDelete = [];

  values.forEach(function(row, index) {
    const rowSnapshotRunId = String(row[snapshotCol] || "").trim();

    if (rowSnapshotRunId === String(snapshotRunId || "").trim()) {
      rowsToDelete.push(index + 2);
    }
  });

  // ✅ ลบจากล่างขึ้นบน เพื่อไม่ให้เลขแถวเลื่อน
  rowsToDelete
    .sort(function(a, b) {
      return b - a;
    })
    .forEach(function(rowNumber) {
      sheet.deleteRow(rowNumber);
    });

  SpreadsheetApp.flush();

  return rowsToDelete.length;
}


    function testStep125WriteSnapshotThenRollback() {
      const lock = LockService.getScriptLock();
      let locked = false;

      let snapshotRunId = "";
      let deletedCount = 0;
      let cleanupError = "";

      try {
        locked = lock.tryLock(10000);

        if (!locked) {
          throw new Error("ระบบกำลังทำงานอยู่ กรุณาลองใหม่อีกครั้ง");
        }

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const taskSheet = ss.getSheetByName(SHEET_NAME);
        const historySheet = setupHistorySheet();

        if (!taskSheet || !historySheet) {
          throw new Error("ไม่พบ TaskData หรือ TaskHistory");
        }

        const period = getActivePeriodInfo();
        const now = new Date();

        // ✅ ตรวจ DQ ก่อนเขียนจริง
        const dq = validateDataQualityBeforeClosePeriod_();

        if (!dq.success) {
          return {
            success: false,
            stage: "DATA_QUALITY",
            message: "Data Quality ไม่ผ่าน จึงไม่เขียน Snapshot ทดสอบ",
            periodKey: period.key,
            periodLabel: period.label,
            criticalCount: dq.criticalCount,
            warningCount: dq.warningCount,
            issues: dq.issues
          };
        }

        snapshotRunId = "TEST-SNAP-" + Utilities.getUuid();

        const taskData = taskSheet.getDataRange().getValues();
        const taskHeaders = taskData.shift().map(function(h) {
          return String(h || "").trim();
        });

        if (!taskData.length) {
          return {
            success: false,
            stage: "NO_TASK",
            message: "ไม่มีข้อมูล TaskData สำหรับทดสอบ Snapshot",
            periodKey: period.key,
            periodLabel: period.label
          };
        }

        const historyLastCol = historySheet.getLastColumn();

        const historyHeaders = historySheet
          .getRange(1, 1, 1, historyLastCol)
          .getValues()[0]
          .map(function(h) {
            return String(h || "").trim();
          });

        const newRows = [];
        let skippedNoTaskId = 0;

        taskData.forEach(function(row) {
          const task = Object.fromEntries(
            taskHeaders.map(function(h, i) {
              return [h, row[i]];
            })
          );

          const taskId = String(task.ID || "").trim();

          if (!taskId) {
            skippedNoTaskId++;
            return;
          }

          const snapshot = buildSnapshotComputedFields_(task, period);

          const historyRow = historyHeaders.map(function(h) {
            switch (h) {
              case "HistoryID":
                return "TEST-HIST-" + Utilities.getUuid();

              case "TaskID":
                return task.ID || "";

              case "TaskName":
                return task.Task || "";

              case "PeriodLabel":
                return period.label;

              case "PeriodStart":
                return period.start;

              case "PeriodEnd":
                return period.end;

              case "Status":
                return task.Status || "";

              case "ProgressMode":
                return task.ProgressMode || "";

              case "Progress":
                return valueOrBlank_(task.Progress);

              case "ProgressOutcome":
                return valueOrBlank_(task.ProgressOutcome);

              case "BaselineUnit":
                return task.BaselineUnit || "";

              case "Outcomes":
                return task.Outcomes || "";

              case "PassOutcomes":
                return task.PassOutcomes || "";

              case "Challenges":
                return task.Challenges || "";

              case "NextSteps":
                return task.NextSteps || "";

              case "RecordedAt":
                return now;

              case "SnapshotRunID":
                return snapshotRunId;

              case "SnapshotAt":
                return now;

              case "SnapshotBy":
                return "STEP12_5_TEST_ROLLBACK";

              case "InputStatus":
                return snapshot.inputStatusForHistory;

              case "InputPeriodKey":
                return snapshot.inputPeriodKeyForHistory;

              case "InputPeriodLabel":
                return snapshot.inputPeriodLabelForHistory;

              case "SubmittedAt":
                return snapshot.submittedAtForHistory;

              case "SubmittedBy":
                return snapshot.submittedByForHistory;

              case "Department":
                return task.Department || "";

              case "WorkGroup":
                return task.WorkGroup || "";

              case "Assignee":
                return task.Assignee || "";

              case "Priority":
                return task.Priority || "";

              case "Deadline":
                return task.Deadline || "";

              case "SubDep":
                return task.SubDep || "";

              case "SubDepLabel":
                return typeof getSubDepLabelFromConfig_ === "function"
                  ? getSubDepLabelFromConfig_(task.SubDep || "", true)
                  : "";

              case "ReportingFrequency":
                return normalizeReportingFrequencyForSnapshot_(task.ReportingFrequency);

              case "ReportingMonths":
                return task.ReportingMonths || "";

              case "IsDueThisPeriod":
                return snapshot.isDueThisPeriod;

              case "ReportingStatus":
                return snapshot.reportingStatus;

              case "Link":
                return task.Link || "";

              case "Baseline":
                return valueOrBlank_(task.Baseline);

              case "ProgressP":
                return valueOrBlank_(task.ProgressP);

              case "ProgressH":
                return valueOrBlank_(task.ProgressH);

              case "ProgressR":
                return valueOrBlank_(task.ProgressR);

              case "OutcomeUnit":
                return task.OutcomeUnit || "";

              case "EvaluateMode":
                return task.EvaluateMode || "";

              case "TargetOperator":
                return task.TargetOperator || "";

              case "TargetValue":
                return valueOrBlank_(task.TargetValue);

              case "TargetText":
                return task.TargetText || "";

              case "LevelOrder":
                return task.LevelOrder || "";

              case "ResultValue":
                return snapshot.canCarryResult
                  ? valueOrBlank_(task.ResultValue)
                  : "";

              case "ResultText":
                return snapshot.canCarryResult
                  ? (task.ResultText || "-")
                  : "-";

              case "ResultLevelText":
                return snapshot.canCarryResult
                  ? (task.ResultLevelText || "")
                  : "";

              case "ResultLevelRank":
                return snapshot.canCarryResult
                  ? valueOrBlank_(task.ResultLevelRank)
                  : "";

              case "TargetLevelText":
                return task.TargetLevelText || "";

              case "TargetLevelRank":
                return valueOrBlank_(task.TargetLevelRank);

              case "AchievementStatus":
                return snapshot.achievementStatusForHistory;

              case "AchievementText":
                return snapshot.achievementTextForHistory;

              default:
                return valueOrBlank_(task[h]);
            }
          });

          newRows.push(historyRow);
        });

        if (!newRows.length) {
          return {
            success: false,
            stage: "NO_ROWS",
            message: "ไม่มีแถวสำหรับเขียน Snapshot ทดสอบ",
            periodKey: period.key,
            periodLabel: period.label,
            skippedNoTaskId: skippedNoTaskId
          };
        }

        const writeStartRow = historySheet.getLastRow() + 1;

        historySheet
          .getRange(writeStartRow, 1, newRows.length, historyHeaders.length)
          .setValues(newRows);

        SpreadsheetApp.flush();

        const verifiedCount = countTaskHistoryRowsBySnapshotRunId_(snapshotRunId);

        if (verifiedCount !== newRows.length) {
          throw new Error(
            "เขียน Snapshot ทดสอบไม่ครบ" +
            "\nต้องเขียน: " + newRows.length +
            "\nตรวจพบจริง: " + verifiedCount +
            "\nSnapshotRunID: " + snapshotRunId
          );
        }

        const snapshotQA = getSnapshotRunQualitySummary_(snapshotRunId);

        // ✅ ลบแถวทดสอบออกทันที ไม่ปล่อยให้ค้าง
        deletedCount = deleteTaskHistoryRowsBySnapshotRunId_(snapshotRunId);

        const afterDeleteCount = countTaskHistoryRowsBySnapshotRunId_(snapshotRunId);

        return {
          success: snapshotQA.success && afterDeleteCount === 0,
          stage: "WRITE_QA_ROLLBACK",
          periodKey: period.key,
          periodLabel: period.label,

          snapshotRunId: snapshotRunId,
          writeCount: newRows.length,
          verifiedCount: verifiedCount,

          snapshotQA: snapshotQA,

          rolledBack: afterDeleteCount === 0,
          deletedCount: deletedCount,
          afterDeleteCount: afterDeleteCount,

          skippedNoTaskId: skippedNoTaskId,

          message:
            snapshotQA.success && afterDeleteCount === 0
              ? "Step 12.5 ผ่าน: เขียนจริง ตรวจ QA จริง และ rollback สำเร็จ"
              : "Step 12.5 ยังไม่ผ่าน: ตรวจ snapshotQA หรือ rollback ไม่ครบ"
        };

      } catch (err) {
        console.error("testStep125WriteSnapshotThenRollback ERROR:", err);

        // ✅ ถ้า error หลังเริ่มเขียนแล้ว พยายามลบ test rows ออก
        if (snapshotRunId) {
          try {
            deletedCount = deleteTaskHistoryRowsBySnapshotRunId_(snapshotRunId);
          } catch (cleanupErr) {
            cleanupError = cleanupErr.message;
          }
        }

        return {
          success: false,
          stage: "ERROR",
          snapshotRunId: snapshotRunId,
          deletedCount: deletedCount,
          cleanupError: cleanupError,
          message: err.message
        };

      } finally {
        if (locked) {
          lock.releaseLock();
        }
      }
    }


    


function formatKpiNumberText_(value) {
  if (value === "" || value === null || value === undefined) return "-";

  const n = Number(value);
  if (isNaN(n)) return String(value);

  return String(Number(n.toFixed(4))).replace(/\.0+$/, "");
}


function formatResultTextByMode_(evaluateMode, resultValue, outcomeUnit, baselineUnit) {
  const mode = String(evaluateMode || "").trim();
  const unit = String(outcomeUnit || baselineUnit || "").trim();

  if (resultValue === "" || resultValue === null || resultValue === undefined) {
    return "-";
  }

  if (mode === "percent" || unit === "ร้อยละ" || unit === "%") {
    return formatKpiNumberText_(resultValue) + "%";
  }

  if (unit) {
    return formatKpiNumberText_(resultValue) + " " + unit;
  }

  return formatKpiNumberText_(resultValue);
}


function getDataQualityBeforeClosePeriodForUI(currentUsername) {
  try {
    requireSuperAdmin_(currentUsername);

    // ✅ ใช้แกน Step 12 ที่ผ่านแล้วเป็น source of truth
    const dq = validateDataQualityBeforeClosePeriod_();

    const orderedIssues = Array.isArray(dq.issues)
      ? dq.issues
      : [];

    return {
      success: true,

      // ✅ ใช้บอก UI ว่าปิดรอบได้ไหม
      dataQualitySuccess: dq.success === true,
      canClose: dq.success === true,

      periodKey: dq.periodKey || "",
      periodLabel: dq.periodLabel || "",

      totalRows: dq.totalRows || 0,
      summary: dq.summary || {
        total: dq.totalRows || 0,
        due: 0,
        notDue: 0,
        submitted: 0,
        notSubmitted: 0,
        notEvaluable: 0
      },

      criticalCount: dq.criticalCount || 0,
      warningCount: dq.warningCount || 0,

      issueSummary: buildDQIssueSummaryForUI_(orderedIssues),

      // ✅ ของเดิมใช้ sampleIssues อยู่แล้ว
      sampleIssues: orderedIssues.slice(0, 20),

      // ✅ เผื่อใช้ใน popup แบบตารางภายหลัง
      issues: orderedIssues.slice(0, 50),
      criticalIssues: dq.criticalIssues || [],
      warningIssues: dq.warningIssues || [],

      generatedAt: new Date().toISOString()
    };

  } catch (err) {
    console.error("getDataQualityBeforeClosePeriodForUI ERROR:", err);

    return {
      success: false,
      dataQualitySuccess: false,
      canClose: false,

      periodKey: "",
      periodLabel: "",

      totalRows: 0,
      summary: {
        total: 0,
        due: 0,
        notDue: 0,
        submitted: 0,
        notSubmitted: 0,
        notEvaluable: 0
      },

      criticalCount: 0,
      warningCount: 0,

      issueSummary: {
        topFields: []
      },

      sampleIssues: [],
      issues: [],
      criticalIssues: [],
      warningIssues: [],

      errorMessage: err.message || "ไม่สามารถตรวจคุณภาพข้อมูลได้"
    };
  }
}

          function previewSnapshotQualityBeforeClosePeriod() {
            const rows = getTaskDataRowsForDQ_();
            const period = getActivePeriodInfo();
            const dq = validateDataQualityBeforeClosePeriod_();

            const summary = {
              periodKey: period.key,
              periodLabel: period.label,
              total: 0,
              due: 0,
              notDue: 0,
              submitted: 0,
              notSubmitted: 0,
              notEvaluable: 0,
              dataQualitySuccess: dq.success,
              criticalCount: dq.criticalCount,
              warningCount: dq.warningCount
            };

            rows.forEach(function(row) {
              const snap = buildSnapshotComputedFields_(row, period);

              summary.total++;

              if (snap.reportingStatus === "NotDue") {
                summary.notDue++;
                return;
              }

              summary.due++;

              if (snap.reportingStatus === "Submitted") {
                summary.submitted++;
              } else if (snap.reportingStatus === "NotSubmitted") {
                summary.notSubmitted++;
              } else if (snap.reportingStatus === "NotEvaluable") {
                summary.notEvaluable++;
              }
            });

            summary.duePlusNotDue = summary.due + summary.notDue;
            summary.submittedPlusNotSubmittedPlusNotEvaluable =
              summary.submitted + summary.notSubmitted + summary.notEvaluable;

            summary.dueCheck = summary.duePlusNotDue === summary.total;
            summary.submittedCheck =
              summary.submittedPlusNotSubmittedPlusNotEvaluable === summary.due;

            return summary;
          }

          function testStep12PreviewSnapshotQuality() {
            const result = previewSnapshotQualityBeforeClosePeriod();
            Logger.log(JSON.stringify(result, null, 2));
            return result;
          }

          function testStep12DataQualityBeforeClose() {
            const result = validateDataQualityBeforeClosePeriod_();
            Logger.log(JSON.stringify(result, null, 2));
            return result;
          }



function buildDQIssueSummaryForUI_(issues) {
  issues = Array.isArray(issues) ? issues : [];

  const fieldMap = {};
  const levelMap = {
    critical: 0,
    warning: 0
  };

  issues.forEach(function(issue) {
    const level = String(issue.level || "warning").trim();
    const field = String(issue.field || "ไม่ระบุ").trim();

    if (!levelMap[level]) {
      levelMap[level] = 0;
    }

    levelMap[level]++;

    if (!fieldMap[field]) {
      fieldMap[field] = {
        field: field,
        count: 0,
        critical: 0,
        warning: 0
      };
    }

    fieldMap[field].count++;

    if (level === "critical") {
      fieldMap[field].critical++;
    } else {
      fieldMap[field].warning++;
    }
  });

  const topFields = Object.keys(fieldMap)
    .map(function(key) {
      return fieldMap[key];
    })
    .sort(function(a, b) {
      return b.count - a.count;
    })
    .slice(0, 8);

  return {
    byLevel: levelMap,
    topFields: topFields
  };
}


function testSnapshotReportingStatusLogic() {
  const period = getActivePeriodInfo();
  const rows = getTaskDataRowsForDQ_();

  const result = rows.slice(0, 20).map(function(row) {
    return {
      rowNumber: row._rowNumber,
      taskName: row.Task,
      reportingFrequency: normalizeReportingFrequencyForSnapshot_(row.ReportingFrequency),
      reportingMonths: row.ReportingMonths || "",
      inputStatus: row.InputStatus || "",
      inputPeriodKey: row.InputPeriodKey || "",
      inputPeriodLabel: row.InputPeriodLabel || "",
      isDueThisPeriod: isTaskDueInSnapshotPeriod_(row, period),
      reportingStatus: getReportingStatusForSnapshot_(row, period),
      achievementStatus: row.AchievementStatus || ""
    };
  });

  Logger.log(JSON.stringify({
    activePeriod: period,
    sample: result
  }, null, 2));

  return result;
}



function testSnapshotReportingStatusSummary() {
  const period = getActivePeriodInfo();
  const rows = getTaskDataRowsForDQ_();

  const summary = {
    activePeriodKey: period.key,
    activePeriodLabel: period.label,
    total: rows.length,

    frequency: {},
    due: 0,
    notDue: 0,

    reportingStatus: {
      Submitted: 0,
      NotSubmitted: 0,
      NotDue: 0,
      NotEvaluable: 0
    },

    samples: {
      notDue: [],
      submitted: [],
      notEvaluable: []
    }
  };

  rows.forEach(function(row) {
    const frequency = normalizeReportingFrequencyForSnapshot_(row.ReportingFrequency);
    const isDue = isTaskDueInSnapshotPeriod_(row, period);
    const reportingStatus = getReportingStatusForSnapshot_(row, period);

    summary.frequency[frequency] = (summary.frequency[frequency] || 0) + 1;

    if (isDue) {
      summary.due++;
    } else {
      summary.notDue++;
    }

    summary.reportingStatus[reportingStatus] =
      (summary.reportingStatus[reportingStatus] || 0) + 1;

    const item = {
      rowNumber: row._rowNumber,
      taskName: row.Task,
      reportingFrequency: frequency,
      reportingMonths: row.ReportingMonths || "",
      inputStatus: row.InputStatus || "",
      inputPeriodKey: row.InputPeriodKey || "",
      isDueThisPeriod: isDue,
      reportingStatus: reportingStatus,
      achievementStatus: row.AchievementStatus || ""
    };

    if (reportingStatus === "NotDue" && summary.samples.notDue.length < 5) {
      summary.samples.notDue.push(item);
    }

    if (reportingStatus === "Submitted" && summary.samples.submitted.length < 5) {
      summary.samples.submitted.push(item);
    }

    if (reportingStatus === "NotEvaluable" && summary.samples.notEvaluable.length < 5) {
      summary.samples.notEvaluable.push(item);
    }
  });

  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

function testSnapshotReportingFieldsDryRun() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName(SHEET_NAME);
  const historySheet = setupHistorySheet();

  if (!taskSheet || !historySheet) {
    throw new Error("ไม่พบ TaskData หรือ TaskHistory");
  }

  const period = getActivePeriodInfo();

  const taskData = taskSheet.getDataRange().getValues();
  const taskHeaders = taskData.shift().map(function(h) {
    return String(h || "").trim();
  });

  const historyHeaders = historySheet
    .getRange(1, 1, 1, historySheet.getLastColumn())
    .getValues()[0]
    .map(function(h) {
      return String(h || "").trim();
    });

  const requiredHistoryFields = [
    "ReportingFrequency",
    "ReportingMonths",
    "IsDueThisPeriod",
    "ReportingStatus"
  ];

  const missingHistoryFields = requiredHistoryFields.filter(function(field) {
    return historyHeaders.indexOf(field) === -1;
  });

  if (missingHistoryFields.length) {
    throw new Error(
      "TaskHistory ยังขาดคอลัมน์: " + missingHistoryFields.join(", ")
    );
  }

  const previewRows = [];

  taskData.forEach(function(row, index) {
    const task = Object.fromEntries(
      taskHeaders.map(function(h, i) {
        return [h, row[i]];
      })
    );

    const taskId = String(task.ID || "").trim();
    if (!taskId) return;

    const reportingFrequency = normalizeReportingFrequencyForSnapshot_(
      task.ReportingFrequency
    );

    const isDue = isTaskDueInSnapshotPeriod_(task, period);
    const reportingStatus = getReportingStatusForSnapshot_(task, period);

    previewRows.push({
      rowNumber: index + 2,
      taskId: taskId,
      taskName: task.Task || "",
      inputStatus: task.InputStatus || "",
      inputPeriodKey: task.InputPeriodKey || "",
      achievementStatus: task.AchievementStatus || "",

      ReportingFrequency: reportingFrequency,
      ReportingMonths: task.ReportingMonths || "",
      IsDueThisPeriod: isDue,
      ReportingStatus: reportingStatus
    });
  });

  const summary = {
    activePeriodKey: period.key,
    activePeriodLabel: period.label,
    total: previewRows.length,

    reportingStatus: {
      Submitted: 0,
      NotSubmitted: 0,
      NotDue: 0,
      NotEvaluable: 0
    },

    samples: {
      notDue: [],
      submitted: [],
      notSubmitted: [],
      notEvaluable: []
    }
  };

  previewRows.forEach(function(row) {
    const status = row.ReportingStatus || "NotSubmitted";

    summary.reportingStatus[status] =
      (summary.reportingStatus[status] || 0) + 1;

    if (status === "NotDue" && summary.samples.notDue.length < 5) {
      summary.samples.notDue.push(row);
    }

    if (status === "Submitted" && summary.samples.submitted.length < 5) {
      summary.samples.submitted.push(row);
    }

    if (status === "NotSubmitted" && summary.samples.notSubmitted.length < 5) {
      summary.samples.notSubmitted.push(row);
    }

    if (status === "NotEvaluable" && summary.samples.notEvaluable.length < 5) {
      summary.samples.notEvaluable.push(row);
    }
  });

  Logger.log(JSON.stringify(summary, null, 2));

  return summary;
}


function getPeriodKeyFromAnyDateForSnapshotCheck_(value) {
  if (!value) return "";

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return "";
  }

  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}


function testSnapshotDuplicateBeforeRealRun() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const taskSheet = ss.getSheetByName(SHEET_NAME);
  const historySheet = setupHistorySheet();
  const period = getActivePeriodInfo();

  if (!taskSheet) {
    throw new Error("ไม่พบชีต TaskData");
  }

  if (!historySheet) {
    throw new Error("ไม่พบชีต TaskHistory");
  }

  // ===============================
  // 1) อ่าน TaskData เพื่อดูจำนวนตัวชี้วัดที่จะ snapshot
  // ===============================
  const taskValues = taskSheet.getDataRange().getValues();

  if (taskValues.length < 2) {
    return {
      canRunSnapshotNow: false,
      reason: "TaskData ไม่มีรายการตัวชี้วัด",
      activePeriodKey: period.key,
      activePeriodLabel: period.label
    };
  }

  const taskHeaders = taskValues[0].map(function(h) {
    return String(h || "").trim();
  });

  const taskIdCol = taskHeaders.indexOf("ID");
  const taskNameCol = taskHeaders.indexOf("Task");

  if (taskIdCol === -1) {
    throw new Error("TaskData ไม่มีคอลัมน์ ID");
  }

  const taskMap = {};
  const taskSamples = [];

  for (let i = 1; i < taskValues.length; i++) {
    const row = taskValues[i];
    const taskId = String(row[taskIdCol] || "").trim();

    if (!taskId) continue;

    taskMap[taskId] = {
      rowNumber: i + 1,
      taskId: taskId,
      taskName: taskNameCol !== -1 ? row[taskNameCol] || "" : ""
    };

    if (taskSamples.length < 5) {
      taskSamples.push(taskMap[taskId]);
    }
  }

  const totalTasks = Object.keys(taskMap).length;

  // ===============================
  // 2) อ่าน TaskHistory เพื่อดูว่ารอบนี้เคย snapshot แล้วไหม
  // ===============================
  const historyLastRow = historySheet.getLastRow();
  const historyLastCol = historySheet.getLastColumn();

  if (historyLastRow < 2 || historyLastCol < 1) {
    return {
      canRunSnapshotNow: true,
      status: "OK_NEW_PERIOD",
      reason: "TaskHistory ยังไม่มีข้อมูลรอบนี้",
      activePeriodKey: period.key,
      activePeriodLabel: period.label,
      totalTasks: totalTasks,
      existingHistoryRowsForPeriod: 0,
      uniqueTaskIdsAlreadySnapshotted: 0,
      newRowsWouldWrite: totalTasks,
      alreadySnapshottedTasks: 0,
      samples: {
        taskData: taskSamples,
        existingHistory: []
      }
    };
  }

  const historyValues = historySheet.getRange(1, 1, historyLastRow, historyLastCol).getValues();
  const historyHeaders = historyValues[0].map(function(h) {
    return String(h || "").trim();
  });

  const hTaskIdCol = historyHeaders.indexOf("TaskID");
  const hTaskNameCol = historyHeaders.indexOf("TaskName");
  const hPeriodLabelCol = historyHeaders.indexOf("PeriodLabel");
  const hInputPeriodKeyCol = historyHeaders.indexOf("InputPeriodKey");
  const hPeriodStartCol = historyHeaders.indexOf("PeriodStart");
  const hSnapshotRunIdCol = historyHeaders.indexOf("SnapshotRunID");
  const hReportingStatusCol = historyHeaders.indexOf("ReportingStatus");

  if (hTaskIdCol === -1) {
    throw new Error("TaskHistory ไม่มีคอลัมน์ TaskID");
  }

  const existingTaskIds = {};
  const existingHistorySamples = [];
  let existingHistoryRowsForPeriod = 0;

  for (let r = 1; r < historyValues.length; r++) {
    const row = historyValues[r];

    const historyTaskId = String(row[hTaskIdCol] || "").trim();
    if (!historyTaskId) continue;

    const periodLabel = hPeriodLabelCol !== -1
      ? String(row[hPeriodLabelCol] || "").trim()
      : "";

    const inputPeriodKey = hInputPeriodKeyCol !== -1
      ? String(row[hInputPeriodKeyCol] || "").trim()
      : "";

    const periodStartKey = hPeriodStartCol !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[hPeriodStartCol])
      : "";

    const samePeriod =
      periodLabel === String(period.label || "").trim() ||
      inputPeriodKey === String(period.key || "").trim() ||
      periodStartKey === String(period.key || "").trim();

    if (!samePeriod) continue;

    existingHistoryRowsForPeriod++;
    existingTaskIds[historyTaskId] = true;

    if (existingHistorySamples.length < 10) {
      existingHistorySamples.push({
        rowNumber: r + 1,
        taskId: historyTaskId,
        taskName: hTaskNameCol !== -1 ? row[hTaskNameCol] || "" : "",
        periodLabel: periodLabel,
        inputPeriodKey: inputPeriodKey,
        periodStartKey: periodStartKey,
        snapshotRunId: hSnapshotRunIdCol !== -1 ? row[hSnapshotRunIdCol] || "" : "",
        reportingStatus: hReportingStatusCol !== -1 ? row[hReportingStatusCol] || "" : ""
      });
    }
  }

  const taskIds = Object.keys(taskMap);

  const alreadySnapshottedTasks = taskIds.filter(function(id) {
    return !!existingTaskIds[id];
  }).length;

  const newRowsWouldWrite = taskIds.filter(function(id) {
    return !existingTaskIds[id];
  }).length;

  let status = "OK_NEW_PERIOD";
  let canRunSnapshotNow = true;
  let reason = "รอบนี้ยังไม่พบข้อมูล snapshot เดิม สามารถทดสอบ snapshot จริงได้";

  if (existingHistoryRowsForPeriod > 0 && newRowsWouldWrite === 0) {
    status = "BLOCK_DUPLICATE_FULL";
    canRunSnapshotNow = false;
    reason = "รอบนี้มี snapshot ครบแล้ว ห้ามรันซ้ำ";
  } else if (existingHistoryRowsForPeriod > 0 && newRowsWouldWrite > 0) {
    status = "WARNING_PARTIAL_DUPLICATE";
    canRunSnapshotNow = false;
    reason = "พบ snapshot บางส่วนของรอบนี้แล้ว ยังไม่ควรรันต่อ เพราะอาจทำให้ history ไม่ครบหรือซ้ำบางส่วน";
  }

  const summary = {
    canRunSnapshotNow: canRunSnapshotNow,
    status: status,
    reason: reason,

    activePeriodKey: period.key,
    activePeriodLabel: period.label,

    totalTasks: totalTasks,
    existingHistoryRowsForPeriod: existingHistoryRowsForPeriod,
    uniqueTaskIdsAlreadySnapshotted: Object.keys(existingTaskIds).length,
    alreadySnapshottedTasks: alreadySnapshottedTasks,
    newRowsWouldWrite: newRowsWouldWrite,

    samples: {
      taskData: taskSamples,
      existingHistory: existingHistorySamples
    }
  };

  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

function findQaPartialSnapshotRowsForActivePeriod() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = setupHistorySheet();
  const period = getActivePeriodInfo();

  const lastRow = historySheet.getLastRow();
  const lastCol = historySheet.getLastColumn();

  if (lastRow < 2) {
    return {
      activePeriodKey: period.key,
      activePeriodLabel: period.label,
      count: 0,
      rows: []
    };
  }

  const values = historySheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function(h) {
    return String(h || "").trim();
  });

  const taskIdCol = headers.indexOf("TaskID");
  const taskNameCol = headers.indexOf("TaskName");
  const periodLabelCol = headers.indexOf("PeriodLabel");
  const periodStartCol = headers.indexOf("PeriodStart");
  const inputPeriodKeyCol = headers.indexOf("InputPeriodKey");
  const snapshotRunIdCol = headers.indexOf("SnapshotRunID");
  const reportingStatusCol = headers.indexOf("ReportingStatus");

  if (taskIdCol === -1 || snapshotRunIdCol === -1) {
    throw new Error("TaskHistory ต้องมีคอลัมน์ TaskID และ SnapshotRunID");
  }

  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const taskId = String(row[taskIdCol] || "").trim();
    const snapshotRunId = String(row[snapshotRunIdCol] || "").trim();

    const periodLabel = periodLabelCol !== -1
      ? String(row[periodLabelCol] || "").trim()
      : "";

    const periodStartKey = periodStartCol !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[periodStartCol])
      : "";

    const inputPeriodKey = inputPeriodKeyCol !== -1
      ? String(row[inputPeriodKeyCol] || "").trim()
      : "";

    const inputPeriodKeyFromDate = inputPeriodKeyCol !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[inputPeriodKeyCol])
      : "";

    const samePeriod =
      periodLabel === String(period.label || "").trim() ||
      periodStartKey === String(period.key || "").trim() ||
      inputPeriodKey === String(period.key || "").trim() ||
      inputPeriodKeyFromDate === String(period.key || "").trim();

    const isQaRow =
      snapshotRunId === "SNAP-QA-HISTORY" &&
      taskId.indexOf("QA-HISTORY-") === 0;

    if (samePeriod && isQaRow) {
      rows.push({
        rowNumber: r + 1,
        taskId: taskId,
        taskName: taskNameCol !== -1 ? row[taskNameCol] || "" : "",
        periodLabel: periodLabel,
        periodStartKey: periodStartKey,
        inputPeriodKey: inputPeriodKey,
        inputPeriodKeyFromDate: inputPeriodKeyFromDate,
        snapshotRunId: snapshotRunId,
        reportingStatus: reportingStatusCol !== -1 ? row[reportingStatusCol] || "" : ""
      });
    }
  }

  const result = {
    activePeriodKey: period.key,
    activePeriodLabel: period.label,
    count: rows.length,
    rows: rows
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function deleteQaPartialSnapshotRowsForActivePeriod() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = setupHistorySheet();

  const preview = findQaPartialSnapshotRowsForActivePeriod();
  const rows = Array.isArray(preview.rows) ? preview.rows : [];

  if (!rows.length) {
    return {
      success: true,
      deleted: 0,
      message: "ไม่พบ QA snapshot ที่ต้องลบ"
    };
  }

  // ✅ ลบจากล่างขึ้นบน ป้องกันเลขแถวเลื่อน
  rows
    .map(function(item) {
      return Number(item.rowNumber);
    })
    .sort(function(a, b) {
      return b - a;
    })
    .forEach(function(rowNumber) {
      historySheet.deleteRow(rowNumber);
    });

  const result = {
    success: true,
    deleted: rows.length,
    activePeriodKey: preview.activePeriodKey,
    activePeriodLabel: preview.activePeriodLabel,
    deletedRows: rows,
    message: "ลบ QA partial snapshot ของรอบนี้เรียบร้อยแล้ว"
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testRunSnapshotOnlyForActivePeriod() {
  const result = snapshotTasks15Days_(true, "SYSTEM_I4_TEST");

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function findTestSnapshotRowsForActivePeriod() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = setupHistorySheet();
  const period = getActivePeriodInfo();

  const lastRow = historySheet.getLastRow();
  const lastCol = historySheet.getLastColumn();

  if (lastRow < 2) {
    return {
      activePeriodKey: period.key,
      activePeriodLabel: period.label,
      count: 0,
      rows: []
    };
  }

  const values = historySheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h || "").trim());

  const idx = {
    taskId: headers.indexOf("TaskID"),
    taskName: headers.indexOf("TaskName"),
    periodLabel: headers.indexOf("PeriodLabel"),
    periodStart: headers.indexOf("PeriodStart"),
    inputPeriodKey: headers.indexOf("InputPeriodKey"),
    snapshotRunId: headers.indexOf("SnapshotRunID"),
    snapshotBy: headers.indexOf("SnapshotBy"),
    reportingStatus: headers.indexOf("ReportingStatus")
  };

  if (idx.taskId === -1 || idx.snapshotRunId === -1 || idx.snapshotBy === -1) {
    throw new Error("TaskHistory ต้องมีคอลัมน์ TaskID, SnapshotRunID, SnapshotBy");
  }

  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const periodLabel = idx.periodLabel !== -1
      ? String(row[idx.periodLabel] || "").trim()
      : "";

    const inputPeriodKey = idx.inputPeriodKey !== -1
      ? String(row[idx.inputPeriodKey] || "").trim()
      : "";

    const inputPeriodKeyFromDate = idx.inputPeriodKey !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[idx.inputPeriodKey])
      : "";

    const periodStartKey = idx.periodStart !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[idx.periodStart])
      : "";

    const samePeriod =
      periodLabel === String(period.label || "").trim() ||
      inputPeriodKey === String(period.key || "").trim() ||
      inputPeriodKeyFromDate === String(period.key || "").trim() ||
      periodStartKey === String(period.key || "").trim();

    const snapshotBy = String(row[idx.snapshotBy] || "").trim();
    const snapshotRunId = String(row[idx.snapshotRunId] || "").trim();

    const isTestSnapshot =
      samePeriod &&
      snapshotBy === "SYSTEM_I4_TEST" &&
      snapshotRunId.indexOf("SNAP-") === 0;

    if (isTestSnapshot) {
      rows.push({
        rowNumber: r + 1,
        taskId: idx.taskId !== -1 ? row[idx.taskId] || "" : "",
        taskName: idx.taskName !== -1 ? row[idx.taskName] || "" : "",
        periodLabel: periodLabel,
        periodStartKey: periodStartKey,
        inputPeriodKey: inputPeriodKey,
        inputPeriodKeyFromDate: inputPeriodKeyFromDate,
        snapshotRunId: snapshotRunId,
        snapshotBy: snapshotBy,
        reportingStatus: idx.reportingStatus !== -1 ? row[idx.reportingStatus] || "" : ""
      });
    }
  }

  const result = {
    activePeriodKey: period.key,
    activePeriodLabel: period.label,
    count: rows.length,
    rows: rows.slice(0, 20),
    firstRowNumber: rows.length ? rows[0].rowNumber : null,
    lastRowNumber: rows.length ? rows[rows.length - 1].rowNumber : null
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function deleteTestSnapshotRowsForActivePeriod() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = setupHistorySheet();

  const preview = findTestSnapshotRowsForActivePeriod();

  // อ่านใหม่แบบเต็ม เพราะ preview.rows ถูก slice แค่ 20 รายการ
  const period = getActivePeriodInfo();
  const lastRow = historySheet.getLastRow();
  const lastCol = historySheet.getLastColumn();
  const values = historySheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h || "").trim());

  const idx = {
    periodLabel: headers.indexOf("PeriodLabel"),
    periodStart: headers.indexOf("PeriodStart"),
    inputPeriodKey: headers.indexOf("InputPeriodKey"),
    snapshotRunId: headers.indexOf("SnapshotRunID"),
    snapshotBy: headers.indexOf("SnapshotBy")
  };

  const rowsToDelete = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const periodLabel = idx.periodLabel !== -1
      ? String(row[idx.periodLabel] || "").trim()
      : "";

    const inputPeriodKey = idx.inputPeriodKey !== -1
      ? String(row[idx.inputPeriodKey] || "").trim()
      : "";

    const inputPeriodKeyFromDate = idx.inputPeriodKey !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[idx.inputPeriodKey])
      : "";

    const periodStartKey = idx.periodStart !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[idx.periodStart])
      : "";

    const samePeriod =
      periodLabel === String(period.label || "").trim() ||
      inputPeriodKey === String(period.key || "").trim() ||
      inputPeriodKeyFromDate === String(period.key || "").trim() ||
      periodStartKey === String(period.key || "").trim();

    const snapshotBy = String(row[idx.snapshotBy] || "").trim();
    const snapshotRunId = String(row[idx.snapshotRunId] || "").trim();

    if (
      samePeriod &&
      snapshotBy === "SYSTEM_I4_TEST" &&
      snapshotRunId.indexOf("SNAP-") === 0
    ) {
      rowsToDelete.push(r + 1);
    }
  }

  if (!rowsToDelete.length) {
    return {
      success: true,
      deleted: 0,
      message: "ไม่พบ Snapshot ทดสอบที่ต้องลบ"
    };
  }

  // ลบจากล่างขึ้นบน กันเลขแถวเลื่อน
  rowsToDelete
    .sort((a, b) => b - a)
    .forEach(rowNumber => {
      historySheet.deleteRow(rowNumber);
    });

  const result = {
    success: true,
    deleted: rowsToDelete.length,
    activePeriodKey: period.key,
    activePeriodLabel: period.label,
    message: "ลบ Snapshot ทดสอบ SYSTEM_I4_TEST เรียบร้อยแล้ว"
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testCloseMonthlyPeriodFlowI6() {
  const beforePeriod = getActivePeriodInfo();

  const result = closeMonthlyPeriod("phanu2544");

  const afterPeriod = getActivePeriodInfo();

  const summary = {
    beforePeriod: beforePeriod,
    closeResult: result,
    afterPeriod: afterPeriod
  };

  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

function repairLevelTargetFieldsForDQ() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error("ไม่พบชีต TaskData");
  }

  const range = sheet.getDataRange();
  const values = range.getValues();

  if (values.length < 2) {
    return {
      success: true,
      updated: 0,
      message: "ไม่มีข้อมูลให้ซ่อม"
    };
  }

  const headers = values[0].map(h => String(h || "").trim());

  const idx = {
    task: headers.indexOf("Task"),
    evaluateMode: headers.indexOf("EvaluateMode"),
    targetValue: headers.indexOf("TargetValue"),
    targetText: headers.indexOf("TargetText"),
    levelOrder: headers.indexOf("LevelOrder"),
    targetLevelText: headers.indexOf("TargetLevelText"),
    targetLevelRank: headers.indexOf("TargetLevelRank"),
    updatedAt: headers.indexOf("UpdatedAt")
  };

  const required = [
    "EvaluateMode",
    "TargetValue",
    "LevelOrder",
    "TargetLevelText",
    "TargetLevelRank"
  ];

  const missing = required.filter(name => headers.indexOf(name) === -1);
  if (missing.length) {
    throw new Error("TaskData ขาดคอลัมน์: " + missing.join(", "));
  }

  function cleanText_(value) {
    return String(value || "")
      .trim()
      .replace(/^>=\s*/g, "")
      .replace(/^<=\s*/g, "")
      .replace(/^>\s*/g, "")
      .replace(/^<\s*/g, "")
      .replace(/^=\s*/g, "")
      .trim();
  }

  function parseLevelOrder_(value) {
    return String(value || "")
      .split(",")
      .map(v => String(v || "").trim())
      .filter(Boolean);
  }

  const updatedRows = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const evaluateMode = String(row[idx.evaluateMode] || "").trim().toLowerCase();

    if (evaluateMode !== "level") {
      continue;
    }

    const currentTargetLevelText = String(row[idx.targetLevelText] || "").trim();
    const currentTargetLevelRank = String(row[idx.targetLevelRank] || "").trim();

    if (currentTargetLevelText && currentTargetLevelRank) {
      continue;
    }

    const levelOrder = parseLevelOrder_(row[idx.levelOrder]);

    let targetText = cleanText_(row[idx.targetValue]);

    if (!targetText) {
      targetText = cleanText_(row[idx.targetText]);
    }

    if (!targetText || !levelOrder.length) {
      continue;
    }

    let rankIndex = levelOrder.findIndex(level => level === targetText);

    // เผื่อบางรายการสะกด/เว้นวรรคต่างกันเล็กน้อย
    if (rankIndex === -1) {
      const targetLower = targetText.toLowerCase();
      rankIndex = levelOrder.findIndex(level => level.toLowerCase() === targetLower);
    }

    if (rankIndex === -1) {
      continue;
    }

    const targetLevelText = levelOrder[rankIndex];
    const targetLevelRank = rankIndex + 1;

    row[idx.targetLevelText] = targetLevelText;
    row[idx.targetLevelRank] = targetLevelRank;

    if (idx.updatedAt !== -1) {
      row[idx.updatedAt] = new Date();
    }

    updatedRows.push({
      rowNumber: r + 1,
      taskName: idx.task !== -1 ? row[idx.task] : "",
      targetValue: row[idx.targetValue],
      levelOrder: levelOrder.join(","),
      targetLevelText: targetLevelText,
      targetLevelRank: targetLevelRank
    });
  }

  if (updatedRows.length) {
    range.setValues(values);
  }

  const result = {
    success: true,
    updated: updatedRows.length,
    updatedRows: updatedRows,
    message: "ซ่อม TargetLevelText / TargetLevelRank สำหรับตัวชี้วัดแบบ level เรียบร้อย"
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function verifyClosedPeriodSnapshotCompleteness_202611() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName(SHEET_NAME);
  const historySheet = setupHistorySheet();

  const periodKey = "2026-11";
  const periodLabel = "พ.ย. 2569";

  const taskValues = taskSheet.getDataRange().getValues();
  const taskHeaders = taskValues[0].map(h => String(h || "").trim());

  const taskIdCol = taskHeaders.indexOf("ID");
  const taskNameCol = taskHeaders.indexOf("Task");

  const taskMap = {};

  for (let i = 1; i < taskValues.length; i++) {
    const id = String(taskValues[i][taskIdCol] || "").trim();
    if (!id) continue;

    taskMap[id] = {
      rowNumber: i + 1,
      taskId: id,
      taskName: taskNameCol !== -1 ? taskValues[i][taskNameCol] || "" : ""
    };
  }

  const historyValues = historySheet.getDataRange().getValues();
  const historyHeaders = historyValues[0].map(h => String(h || "").trim());

  const hTaskIdCol = historyHeaders.indexOf("TaskID");
  const hTaskNameCol = historyHeaders.indexOf("TaskName");
  const hPeriodLabelCol = historyHeaders.indexOf("PeriodLabel");
  const hInputPeriodKeyCol = historyHeaders.indexOf("InputPeriodKey");
  const hPeriodStartCol = historyHeaders.indexOf("PeriodStart");
  const hSnapshotRunIdCol = historyHeaders.indexOf("SnapshotRunID");
  const hReportingStatusCol = historyHeaders.indexOf("ReportingStatus");

  const historyTaskMap = {};
  const samples = [];

  for (let r = 1; r < historyValues.length; r++) {
    const row = historyValues[r];

    const taskId = String(row[hTaskIdCol] || "").trim();
    if (!taskId) continue;

    const periodLabelValue = hPeriodLabelCol !== -1
      ? String(row[hPeriodLabelCol] || "").trim()
      : "";

    const inputPeriodKeyValue = hInputPeriodKeyCol !== -1
      ? String(row[hInputPeriodKeyCol] || "").trim()
      : "";

    const inputPeriodKeyFromDate = hInputPeriodKeyCol !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[hInputPeriodKeyCol])
      : "";

    const periodStartKey = hPeriodStartCol !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[hPeriodStartCol])
      : "";

    const samePeriod =
      periodLabelValue === periodLabel ||
      inputPeriodKeyValue === periodKey ||
      inputPeriodKeyFromDate === periodKey ||
      periodStartKey === periodKey;

    if (!samePeriod) continue;

    historyTaskMap[taskId] = {
      rowNumber: r + 1,
      taskId: taskId,
      taskName: hTaskNameCol !== -1 ? row[hTaskNameCol] || "" : "",
      periodLabel: periodLabelValue,
      inputPeriodKey: inputPeriodKeyValue,
      periodStartKey: periodStartKey,
      snapshotRunId: hSnapshotRunIdCol !== -1 ? row[hSnapshotRunIdCol] || "" : "",
      reportingStatus: hReportingStatusCol !== -1 ? row[hReportingStatusCol] || "" : ""
    };

    if (samples.length < 10) {
      samples.push(historyTaskMap[taskId]);
    }
  }

  const taskIds = Object.keys(taskMap);
  const historyTaskIds = Object.keys(historyTaskMap);

  const missing = taskIds
    .filter(id => !historyTaskMap[id])
    .map(id => taskMap[id]);

  const result = {
    periodKey: periodKey,
    periodLabel: periodLabel,
    totalTasks: taskIds.length,
    historyRowsForPeriod: historyTaskIds.length,
    missingCount: missing.length,
    missing: missing,
    samples: samples
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function previewBlankReportingFieldsInHistory202611() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = setupHistorySheet();

  const periodKey = "2026-11";
  const periodLabel = "พ.ย. 2569";

  const values = historySheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h || "").trim());

  const idx = {
    taskId: headers.indexOf("TaskID"),
    taskName: headers.indexOf("TaskName"),
    periodLabel: headers.indexOf("PeriodLabel"),
    periodStart: headers.indexOf("PeriodStart"),
    inputPeriodKey: headers.indexOf("InputPeriodKey"),
    snapshotRunId: headers.indexOf("SnapshotRunID"),
    reportingFrequency: headers.indexOf("ReportingFrequency"),
    isDueThisPeriod: headers.indexOf("IsDueThisPeriod"),
    reportingStatus: headers.indexOf("ReportingStatus")
  };

  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const rowPeriodLabel = idx.periodLabel !== -1
      ? String(row[idx.periodLabel] || "").trim()
      : "";

    const periodStartKey = idx.periodStart !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[idx.periodStart])
      : "";

    const inputPeriodKey = idx.inputPeriodKey !== -1
      ? String(row[idx.inputPeriodKey] || "").trim()
      : "";

    const inputPeriodKeyFromDate = idx.inputPeriodKey !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[idx.inputPeriodKey])
      : "";

    const samePeriod =
      rowPeriodLabel === periodLabel ||
      periodStartKey === periodKey ||
      inputPeriodKey === periodKey ||
      inputPeriodKeyFromDate === periodKey;

    if (!samePeriod) continue;

    const reportingStatus = idx.reportingStatus !== -1
      ? String(row[idx.reportingStatus] || "").trim()
      : "";

    if (!reportingStatus) {
      rows.push({
        rowNumber: r + 1,
        taskId: idx.taskId !== -1 ? row[idx.taskId] || "" : "",
        taskName: idx.taskName !== -1 ? row[idx.taskName] || "" : "",
        snapshotRunId: idx.snapshotRunId !== -1 ? row[idx.snapshotRunId] || "" : "",
        reportingFrequency: idx.reportingFrequency !== -1 ? row[idx.reportingFrequency] || "" : "",
        isDueThisPeriod: idx.isDueThisPeriod !== -1 ? row[idx.isDueThisPeriod] || "" : "",
        reportingStatus: reportingStatus
      });
    }
  }

  const result = {
    periodKey: periodKey,
    periodLabel: periodLabel,
    blankCount: rows.length,
    rows: rows
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function repairBlankReportingFieldsInHistory202611() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName(SHEET_NAME);
  const historySheet = setupHistorySheet();

  const period = {
    key: "2026-11",
    label: "พ.ย. 2569"
  };

  const taskValues = taskSheet.getDataRange().getValues();
  const taskHeaders = taskValues[0].map(h => String(h || "").trim());

  const taskIdx = {
    id: taskHeaders.indexOf("ID"),
    reportingFrequency: taskHeaders.indexOf("ReportingFrequency"),
    reportingMonths: taskHeaders.indexOf("ReportingMonths")
  };

  const taskMap = {};

  for (let i = 1; i < taskValues.length; i++) {
    const row = taskValues[i];
    const id = String(row[taskIdx.id] || "").trim();

    if (!id) continue;

    taskMap[id] = {
      ReportingFrequency: taskIdx.reportingFrequency !== -1 ? row[taskIdx.reportingFrequency] || "" : "",
      ReportingMonths: taskIdx.reportingMonths !== -1 ? row[taskIdx.reportingMonths] || "" : ""
    };
  }

  const range = historySheet.getDataRange();
  const values = range.getValues();
  const headers = values[0].map(h => String(h || "").trim());

  const idx = {
    taskId: headers.indexOf("TaskID"),
    taskName: headers.indexOf("TaskName"),
    periodLabel: headers.indexOf("PeriodLabel"),
    periodStart: headers.indexOf("PeriodStart"),
    inputStatus: headers.indexOf("InputStatus"),
    inputPeriodKey: headers.indexOf("InputPeriodKey"),
    inputPeriodLabel: headers.indexOf("InputPeriodLabel"),
    achievementStatus: headers.indexOf("AchievementStatus"),
    reportingFrequency: headers.indexOf("ReportingFrequency"),
    reportingMonths: headers.indexOf("ReportingMonths"),
    isDueThisPeriod: headers.indexOf("IsDueThisPeriod"),
    reportingStatus: headers.indexOf("ReportingStatus")
  };

  const required = [
    "TaskID",
    "PeriodLabel",
    "InputStatus",
    "InputPeriodKey",
    "InputPeriodLabel",
    "AchievementStatus",
    "ReportingFrequency",
    "ReportingMonths",
    "IsDueThisPeriod",
    "ReportingStatus"
  ];

  const missing = required.filter(name => headers.indexOf(name) === -1);

  if (missing.length) {
    throw new Error("TaskHistory ขาดคอลัมน์: " + missing.join(", "));
  }

  function getMonthFromPeriodKey_(key) {
    const m = String(key || "").match(/^\d{4}-(\d{2})$/);
    return m ? Number(m[1]) : 0;
  }

  function parseMonths_(value) {
    return String(value || "")
      .split(/[,;|\s]+/)
      .map(v => Number(String(v || "").trim()))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 12);
  }

  function isSubmittedForPeriod_(historyTask) {
    const inputStatus = String(historyTask.InputStatus || "").trim();

    if (inputStatus !== "Submitted") {
      return false;
    }

    const inputPeriodKey =
      normalizePeriodKeyServer_(historyTask.InputPeriodKey) ||
      getPeriodKeyFromAnyDateForSnapshotCheck_(historyTask.InputPeriodKey) ||
      String(historyTask.InputPeriodKey || "").trim();

    const inputPeriodLabel = String(historyTask.InputPeriodLabel || "").trim();

    return inputPeriodKey === period.key || inputPeriodLabel === period.label;
  }

  function isDueForPeriod_(historyTask) {
    const frequency = normalizeReportingFrequencyForSnapshot_(historyTask.ReportingFrequency);
    const monthNumber = getMonthFromPeriodKey_(period.key);
    const reportingMonths = parseMonths_(historyTask.ReportingMonths);

    if (frequency === "Monthly") return true;
    if (frequency === "Quarterly") return [3, 6, 9, 12].indexOf(monthNumber) !== -1;
    if (frequency === "SemiAnnual") return [3, 9].indexOf(monthNumber) !== -1;
    if (frequency === "Annual") return monthNumber === 9;
    if (frequency === "Custom") return reportingMonths.indexOf(monthNumber) !== -1;
    if (frequency === "AdHoc") return isSubmittedForPeriod_(historyTask);

    return true;
  }

  function getStatus_(historyTask) {
    const isDue = isDueForPeriod_(historyTask);

    if (!isDue) {
      return "NotDue";
    }

    if (!isSubmittedForPeriod_(historyTask)) {
      return "NotSubmitted";
    }

    const achievementStatus = String(historyTask.AchievementStatus || "").trim();

    if (!achievementStatus || achievementStatus === "NoData" || achievementStatus === "NotEvaluable") {
      return "NotEvaluable";
    }

    return "Submitted";
  }

  const updatedRows = [];
  const statusSummary = {
    Submitted: 0,
    NotSubmitted: 0,
    NotDue: 0,
    NotEvaluable: 0
  };

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const rowPeriodLabel = String(row[idx.periodLabel] || "").trim();
    const periodStartKey = idx.periodStart !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[idx.periodStart])
      : "";

    const inputPeriodKeyRaw = String(row[idx.inputPeriodKey] || "").trim();
    const inputPeriodKeyFromDate = getPeriodKeyFromAnyDateForSnapshotCheck_(row[idx.inputPeriodKey]);

    const samePeriod =
      rowPeriodLabel === period.label ||
      periodStartKey === period.key ||
      inputPeriodKeyRaw === period.key ||
      inputPeriodKeyFromDate === period.key;

    if (!samePeriod) continue;

    const currentReportingStatus = String(row[idx.reportingStatus] || "").trim();

    if (currentReportingStatus) {
      statusSummary[currentReportingStatus] = (statusSummary[currentReportingStatus] || 0) + 1;
      continue;
    }

    const taskId = String(row[idx.taskId] || "").trim();
    const taskConfig = taskMap[taskId] || {};

    const historyTask = {
      ReportingFrequency: row[idx.reportingFrequency] || taskConfig.ReportingFrequency || "Monthly",
      ReportingMonths: row[idx.reportingMonths] || taskConfig.ReportingMonths || "",
      InputStatus: row[idx.inputStatus] || "",
      InputPeriodKey: row[idx.inputPeriodKey] || "",
      InputPeriodLabel: row[idx.inputPeriodLabel] || "",
      AchievementStatus: row[idx.achievementStatus] || ""
    };

    const frequency = normalizeReportingFrequencyForSnapshot_(historyTask.ReportingFrequency);
    const due = isDueForPeriod_(historyTask);
    const status = getStatus_(historyTask);

    row[idx.reportingFrequency] = frequency;
    row[idx.reportingMonths] = historyTask.ReportingMonths || "";
    row[idx.isDueThisPeriod] = due;
    row[idx.reportingStatus] = status;

    statusSummary[status] = (statusSummary[status] || 0) + 1;

    updatedRows.push({
      rowNumber: r + 1,
      taskId: taskId,
      taskName: idx.taskName !== -1 ? row[idx.taskName] || "" : "",
      reportingFrequency: frequency,
      isDueThisPeriod: due,
      reportingStatus: status
    });
  }

  if (updatedRows.length) {
    range.setValues(values);
  }

  const result = {
    success: true,
    periodKey: period.key,
    periodLabel: period.label,
    updated: updatedRows.length,
    updatedRows: updatedRows,
    statusSummary: statusSummary,
    message: "ซ่อม Reporting fields ที่ว่างใน TaskHistory รอบ พ.ย. 2569 เรียบร้อย"
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function validateSnapshotStateBeforeClosePeriod_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName(SHEET_NAME);
  const historySheet = setupHistorySheet();
  const period = getActivePeriodInfo();

  if (!taskSheet) {
    throw new Error("ไม่พบชีต TaskData");
  }

  const taskValues = taskSheet.getDataRange().getValues();
  const taskHeaders = taskValues[0].map(h => String(h || "").trim());

  const taskIdCol = taskHeaders.indexOf("ID");

  if (taskIdCol === -1) {
    throw new Error("TaskData ไม่มีคอลัมน์ ID");
  }

  const taskIds = [];

  for (let i = 1; i < taskValues.length; i++) {
    const id = String(taskValues[i][taskIdCol] || "").trim();
    if (id) taskIds.push(id);
  }

  const expectedTotal = taskIds.length;

  const lastRow = historySheet.getLastRow();
  const lastCol = historySheet.getLastColumn();

  if (lastRow < 2) {
    return {
      ok: true,
      status: "NO_HISTORY_FOR_PERIOD",
      periodKey: period.key,
      periodLabel: period.label,
      expectedTotal: expectedTotal,
      existingRows: 0,
      message: "ยังไม่มี snapshot รอบนี้ สามารถปิดรอบได้"
    };
  }

  const values = historySheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h || "").trim());

  const idx = {
    taskId: headers.indexOf("TaskID"),
    taskName: headers.indexOf("TaskName"),
    periodLabel: headers.indexOf("PeriodLabel"),
    periodStart: headers.indexOf("PeriodStart"),
    inputPeriodKey: headers.indexOf("InputPeriodKey"),
    snapshotRunId: headers.indexOf("SnapshotRunID"),
    reportingStatus: headers.indexOf("ReportingStatus")
  };

  if (idx.taskId === -1) {
    throw new Error("TaskHistory ไม่มีคอลัมน์ TaskID");
  }

  const existingTaskIds = {};
  const existingRows = [];
  const blankReportingRows = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const taskId = String(row[idx.taskId] || "").trim();
    if (!taskId) continue;

    const periodLabel = idx.periodLabel !== -1
      ? String(row[idx.periodLabel] || "").trim()
      : "";

    const inputPeriodKey = idx.inputPeriodKey !== -1
      ? String(row[idx.inputPeriodKey] || "").trim()
      : "";

    const inputPeriodKeyFromDate = idx.inputPeriodKey !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[idx.inputPeriodKey])
      : "";

    const periodStartKey = idx.periodStart !== -1
      ? getPeriodKeyFromAnyDateForSnapshotCheck_(row[idx.periodStart])
      : "";

    const samePeriod =
      periodLabel === String(period.label || "").trim() ||
      inputPeriodKey === String(period.key || "").trim() ||
      inputPeriodKeyFromDate === String(period.key || "").trim() ||
      periodStartKey === String(period.key || "").trim();

    if (!samePeriod) continue;

    existingTaskIds[taskId] = true;

    const reportingStatus = idx.reportingStatus !== -1
      ? String(row[idx.reportingStatus] || "").trim()
      : "";

    const item = {
      rowNumber: r + 1,
      taskId: taskId,
      taskName: idx.taskName !== -1 ? row[idx.taskName] || "" : "",
      snapshotRunId: idx.snapshotRunId !== -1 ? row[idx.snapshotRunId] || "" : "",
      reportingStatus: reportingStatus
    };

    existingRows.push(item);

    if (!reportingStatus) {
      blankReportingRows.push(item);
    }
  }

  const existingCount = Object.keys(existingTaskIds).length;

  if (existingCount === 0) {
    return {
      ok: true,
      status: "OK_NEW_PERIOD",
      periodKey: period.key,
      periodLabel: period.label,
      expectedTotal: expectedTotal,
      existingRows: 0,
      message: "ยังไม่มี snapshot รอบนี้ สามารถปิดรอบได้"
    };
  }

  if (existingCount > 0 && existingCount < expectedTotal) {
    return {
      ok: false,
      status: "BLOCK_PARTIAL_SNAPSHOT",
      periodKey: period.key,
      periodLabel: period.label,
      expectedTotal: expectedTotal,
      existingRows: existingCount,
      blankReportingRows: blankReportingRows.slice(0, 20),
      samples: existingRows.slice(0, 20),
      message: "พบ snapshot บางส่วนของรอบนี้ ห้ามปิดรอบจนกว่าจะลบหรือซ่อมข้อมูล"
    };
  }

  if (blankReportingRows.length > 0) {
    return {
      ok: false,
      status: "BLOCK_INCOMPLETE_REPORTING_FIELDS",
      periodKey: period.key,
      periodLabel: period.label,
      expectedTotal: expectedTotal,
      existingRows: existingCount,
      blankReportingRows: blankReportingRows.slice(0, 20),
      message: "พบ snapshot รอบนี้ที่ ReportingStatus ว่าง ห้ามปิดรอบจนกว่าจะซ่อมข้อมูล"
    };
  }

  return {
    ok: false,
    status: "BLOCK_ALREADY_CLOSED",
    periodKey: period.key,
    periodLabel: period.label,
    expectedTotal: expectedTotal,
    existingRows: existingCount,
    message: "รอบนี้มี snapshot ครบแล้ว ห้ามปิดรอบซ้ำ"
  };
}



function testPreflightGuardI7() {
  const result = validateSnapshotStateBeforeClosePeriod_();

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}


function normalizeReportingFrequencyInput_(value) {
  const v = String(value || "").trim();

  const allowed = [
    "Monthly",
    "Quarterly",
    "SemiAnnual",
    "Annual",
    "Custom",
    "AdHoc"
  ];

  return allowed.indexOf(v) !== -1 ? v : "Monthly";
}

function normalizeReportingMonthsInput_(months, frequency) {
  const freq = normalizeReportingFrequencyInput_(frequency);

  if (freq !== "Custom") {
    return "";
  }

  return String(months || "")
    .split(/[,;|\s]+/)
    .map(function(v) {
      return Number(String(v || "").trim());
    })
    .filter(function(n) {
      return Number.isFinite(n) && n >= 1 && n <= 12;
    })
    .sort(function(a, b) {
      return a - b;
    })
    .join(",");
}

function testStep125LogResult() {
  const result = testStep125WriteSnapshotThenRollback();

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}


function testStep13MonthlyClosedReportCore() {
  const report = monthlyReportBuild_("", {});

  const result = {
    success: report.success,
    periodKey: report.periodKey,
    periodLabel: report.periodLabel,

    total: report.total,
    due: report.due,
    notDue: report.notDue,

    submitted: report.submitted,
    notSubmitted: report.notSubmitted,
    notEvaluable: report.notEvaluable,
    sent: report.sent,

    met: report.met,
    notMet: report.notMet,

    submittedPercent: report.submittedPercent,
    sentPercent: report.sentPercent,
    metPercent: report.metPercent,

    duePlusNotDue: report.due + report.notDue,
    submittedPlusNotSubmittedPlusNotEvaluable:
      report.submitted + report.notSubmitted + report.notEvaluable,

    dueCheck: report.dueCheck,
    submittedCheck: report.submittedCheck,

    followUpCount: Array.isArray(report.followUpItems)
      ? report.followUpItems.length
      : 0,

    notDueInFollowUp: Array.isArray(report.followUpItems)
      ? report.followUpItems.filter(item => item.reportingStatus === "NotDue").length
      : 0,

    departmentGroups: Array.isArray(report.byDepartment)
      ? report.byDepartment.length
      : 0,

    workGroupGroups: Array.isArray(report.byWorkGroup)
      ? report.byWorkGroup.length
      : 0
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}



      function step15_PostCloseE2ETest() {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        const taskSheet = ss.getSheetByName("TaskData");
        const historySheet = ss.getSheetByName("TaskHistory");
        const periodSheet = ss.getSheetByName("PeriodControl");

        if (!taskSheet) throw new Error("ไม่พบชีต TaskData");
        if (!historySheet) throw new Error("ไม่พบชีต TaskHistory");
        if (!periodSheet) throw new Error("ไม่พบชีต PeriodControl");

        function sheetToObjects_(sheet) {
          const lastRow = sheet.getLastRow();
          const lastCol = sheet.getLastColumn();

          if (lastRow < 2) return [];

          const headers = sheet
            .getRange(1, 1, 1, lastCol)
            .getValues()[0]
            .map(h => String(h || "").trim());

          const values = sheet
            .getRange(2, 1, lastRow - 1, lastCol)
            .getValues();

          return values.map(row => {
            const obj = {};
            headers.forEach((h, i) => obj[h] = row[i]);
            return obj;
          });
        }

        function getPeriodControl_() {
          const rows = sheetToObjects_(periodSheet);
          const map = {};

          rows.forEach(r => {
            const key = String(r.Key || "").trim();
            if (key) map[key] = r.Value;
          });

          return {
            activePeriodKey: String(map.ActivePeriodKey || "").trim(),
            activePeriodLabel: String(map.ActivePeriodLabel || "").trim(),
            lastClosedPeriodKey: String(map.LastClosedPeriodKey || "").trim(),
            lastClosedPeriodLabel: String(map.LastClosedPeriodLabel || "").trim(),
            lastClosedAt: map.LastClosedAt || "",
            lastClosedBy: String(map.LastClosedBy || "").trim()
          };
        }

        function dateValue_(v) {
          const d = new Date(v);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        }

        function isDueRow_(r) {
          const rawDue = String(r.IsDueThisPeriod ?? "").trim().toLowerCase();
          const reportingStatus = String(r.ReportingStatus || "").trim();

          if (
            rawDue === "false" ||
            rawDue === "0" ||
            rawDue === "no" ||
            reportingStatus === "NotDue"
          ) {
            return false;
          }

          if (
            rawDue === "true" ||
            rawDue === "1" ||
            rawDue === "yes"
          ) {
            return true;
          }

          return reportingStatus !== "NotDue";
        }

        function shouldFollowUp_(r) {
          if (!isDueRow_(r)) return false;

          const inputStatus = String(r.InputStatus || "").trim();
          const achievementStatus = String(r.AchievementStatus || "").trim();

          return (
            inputStatus !== "Submitted" ||
            achievementStatus === "NotMet" ||
            achievementStatus === "NotEvaluable"
          );
        }

        const period = getPeriodControl_();

        const historyRows = sheetToObjects_(historySheet)
          .filter(r => String(r.SnapshotRunID || "").trim());

        if (!historyRows.length) {
          return {
            success: false,
            message: "ไม่พบข้อมูล SnapshotRunID ใน TaskHistory"
          };
        }

        const latestRow = historyRows
          .slice()
          .sort((a, b) => {
            const bt = dateValue_(b.SnapshotAt || b.RecordedAt);
            const at = dateValue_(a.SnapshotAt || a.RecordedAt);
            return bt - at;
          })[0];

        const latestRunId = String(latestRow.SnapshotRunID || "").trim();
        const latestSnapshotAt = latestRow.SnapshotAt || latestRow.RecordedAt || "";
        const latestPeriodKey = String(latestRow.InputPeriodKey || "").trim();
        const latestPeriodLabel = String(latestRow.InputPeriodLabel || latestRow.PeriodLabel || "").trim();

        const latestRows = historyRows.filter(r =>
          String(r.SnapshotRunID || "").trim() === latestRunId
        );

        let due = 0;
        let notDue = 0;
        let submitted = 0;
        let notSubmitted = 0;
        let notEvaluable = 0;
        let met = 0;
        let notMet = 0;
        let followUpCount = 0;
        let notDueInFollowUp = 0;

        latestRows.forEach(r => {
          const isDue = isDueRow_(r);
          const inputStatus = String(r.InputStatus || "").trim();
          const achievementStatus = String(r.AchievementStatus || "").trim();

          if (isDue) {
            due++;

            if (inputStatus === "Submitted") {
              if (achievementStatus === "NotEvaluable") {
                notEvaluable++;
              } else {
                submitted++;
              }

              if (achievementStatus === "Met") met++;
              if (achievementStatus === "NotMet") notMet++;
            } else {
              notSubmitted++;
            }
          } else {
            notDue++;
            if (shouldFollowUp_(r)) notDueInFollowUp++;
          }

          if (shouldFollowUp_(r)) followUpCount++;
        });

        const taskRows = sheetToObjects_(taskSheet);
        const taskTotal = taskRows.length;

        const taskInputStatus = taskRows.reduce((acc, r) => {
          const s = String(r.InputStatus || "").trim() || "-";
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {});

        const result = {
          success: true,
          latestRunId,
          latestSnapshotAt,
          latestPeriodKey,
          latestPeriodLabel,

          periodControl: period,

          taskTotal,

          taskInputStatus,

          snapshotQA: {
            total: latestRows.length,
            due,
            notDue,
            submitted,
            notSubmitted,
            notEvaluable,
            met,
            notMet,
            followUpCount,
            notDueInFollowUp,
            dueCheck: due + notDue === latestRows.length,
            submittedCheck: submitted + notSubmitted + notEvaluable === due
          },

          activeMovedNext:
            !!period.activePeriodKey &&
            !!period.lastClosedPeriodKey &&
            period.activePeriodKey > period.lastClosedPeriodKey
        };

        Logger.log(JSON.stringify(result, null, 2));
        return result;
      }


      function step17_ExportQA_LatestClosedPeriod() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = ss.getSheetByName("TaskHistory");
  const periodSheet = ss.getSheetByName("PeriodControl");

  if (!historySheet) throw new Error("ไม่พบชีต TaskHistory");
  if (!periodSheet) throw new Error("ไม่พบชีต PeriodControl");

  function sheetToObjects_(sheet) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 2) return [];

    const headers = sheet
      .getRange(1, 1, 1, lastCol)
      .getValues()[0]
      .map(h => String(h || "").trim());

    const values = sheet
      .getRange(2, 1, lastRow - 1, lastCol)
      .getValues();

    return values.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  }

  function getPeriodControl_() {
    const rows = sheetToObjects_(periodSheet);
    const map = {};

    rows.forEach(r => {
      const key = String(r.Key || "").trim();
      if (key) map[key] = r.Value;
    });

    return {
      activePeriodKey: String(map.ActivePeriodKey || "").trim(),
      activePeriodLabel: String(map.ActivePeriodLabel || "").trim(),
      lastClosedPeriodKey: String(map.LastClosedPeriodKey || "").trim(),
      lastClosedPeriodLabel: String(map.LastClosedPeriodLabel || "").trim(),
      lastClosedAt: map.LastClosedAt || "",
      lastClosedBy: String(map.LastClosedBy || "").trim()
    };
  }

  function normalizePeriodKey_(value, label) {
    const labelText = String(label || "").trim();

    const monthMap = {
      "ม.ค.": "01", "ก.พ.": "02", "มี.ค.": "03", "เม.ย.": "04",
      "พ.ค.": "05", "มิ.ย.": "06", "ก.ค.": "07", "ส.ค.": "08",
      "ก.ย.": "09", "ต.ค.": "10", "พ.ย.": "11", "ธ.ค.": "12"
    };

    for (const m in monthMap) {
      if (labelText.indexOf(m) !== -1) {
        const ym = labelText.match(/(25\d{2}|20\d{2})/);
        if (ym) {
          let y = Number(ym[1]);
          if (y > 2400) y -= 543;
          return y + "-" + monthMap[m];
        }
      }
    }

    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0");
    }

    const text = String(value || "").trim();

    if (/^\d{4}-\d{2}$/.test(text)) return text;

    if (text.indexOf("T") !== -1 || text.indexOf("GMT") !== -1) {
      const d = new Date(text);
      if (!isNaN(d.getTime())) {
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      }
    }

    const m = text.match(/^(\d{4})-(\d{2})/);
    if (m) return m[1] + "-" + m[2];

    return "";
  }

  function isDueRow_(r) {
    const status = String(r.ReportingStatus || "").trim();
    const rawDue = String(r.IsDueThisPeriod ?? "").trim().toLowerCase();

    if (status === "NotDue") return false;
    if (rawDue === "false" || rawDue === "0" || rawDue === "no") return false;

    return true;
  }

  function isFollowUpRow_(r) {
    if (!isDueRow_(r)) return false;

    const inputStatus = String(r.InputStatus || "").trim();
    const achievementStatus = String(r.AchievementStatus || "").trim();

    return (
      inputStatus !== "Submitted" ||
      achievementStatus === "NotMet" ||
      achievementStatus === "NotEvaluable"
    );
  }

  const period = getPeriodControl_();
  const targetKey = period.lastClosedPeriodKey;
  const targetLabel = period.lastClosedPeriodLabel;

  const rows = sheetToObjects_(historySheet).filter(r => {
    const key = normalizePeriodKey_(
      r.InputPeriodKey || r.PeriodStart || r.SnapshotAt,
      r.InputPeriodLabel || r.PeriodLabel
    );

    return key === targetKey;
  });

  const rawTotal = rows.length;
  const dueRows = rows.filter(isDueRow_);
  const notDueRows = rows.filter(r => !isDueRow_(r));
  const followUpRows = rows.filter(isFollowUpRow_);

  const result = {
    success: true,
    exportPeriodKey: targetKey,
    exportPeriodLabel: targetLabel,

    expected: {
      rawDataRows: rawTotal,
      dueRows: dueRows.length,
      notDueRows: notDueRows.length,
      followUpRows: followUpRows.length
    },

    qa: {
      rawShouldBe231: rawTotal === 231,
      followUpShouldBe229: followUpRows.length === 229,
      notDueShouldBe2: notDueRows.length === 2,
      notDueNotInFollowUp: followUpRows.every(isDueRow_),
      periodIsLatestClosed: targetKey === period.lastClosedPeriodKey
    },

    sample: {
      rawFirst3: rows.slice(0, 3).map(r => ({
        taskName: r.TaskName || r.Task || "",
        inputPeriodKey: r.InputPeriodKey,
        inputPeriodLabel: r.InputPeriodLabel || r.PeriodLabel,
        inputStatus: r.InputStatus,
        reportingStatus: r.ReportingStatus,
        isDueThisPeriod: r.IsDueThisPeriod
      })),
      notDue: notDueRows.slice(0, 5).map(r => ({
        taskName: r.TaskName || r.Task || "",
        inputPeriodKey: r.InputPeriodKey,
        inputPeriodLabel: r.InputPeriodLabel || r.PeriodLabel,
        inputStatus: r.InputStatus,
        reportingStatus: r.ReportingStatus,
        isDueThisPeriod: r.IsDueThisPeriod
      }))
    }
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function migrateTaskDataMasterToDevSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("TaskData");

  if (!sheet) {
    throw new Error("ไม่พบชีต TaskData");
  }

  const DEV_TASKDATA_HEADERS = [
    "ID",
    "Task",
    "Department",
    "Assignee",
    "Priority",
    "Status",
    "Progress",
    "Timestamp",
    "UpdatedAt",
    "Challenges",
    "NextSteps",
    "Deadline",
    "SubDep",
    "Baseline",
    "ProgressP",
    "ProgressH",
    "ProgressR",
    "BaselineUnit",
    "ProgressMode",
    "OutcomeUnit",
    "Outcomes",
    "PassOutcomes",
    "ProgressOutcome",
    "Link",
    "WorkGroup",

    "EvaluateMode",
    "TargetOperator",
    "TargetValue",
    "TargetText",
    "ResultValue",
    "ResultText",
    "ResultLevelText",
    "ResultLevelRank",
    "TargetLevelText",
    "TargetLevelRank",
    "LevelOrder",
    "AchievementStatus",
    "AchievementText",
    "InputStatus",
    "InputPeriodKey",
    "InputPeriodLabel",
    "SubmittedAt",
    "SubmittedBy",
    "ReportingFrequency",
    "ReportingMonths"
  ];

  const now = new Date();
  const tz = Session.getScriptTimeZone();
  const backupName =
    "TaskData_BACKUP_before_dev_schema_" +
    Utilities.formatDate(now, tz, "yyyyMMdd_HHmmss");

  // ✅ Backup ก่อนเสมอ
  const backup = sheet.copyTo(ss);
  backup.setName(backupName);

  const values = sheet.getDataRange().getValues();

  if (!values || values.length === 0) {
    sheet.getRange(1, 1, 1, DEV_TASKDATA_HEADERS.length)
      .setValues([DEV_TASKDATA_HEADERS]);
    sheet.getRange(1, 1, 1, DEV_TASKDATA_HEADERS.length)
      .setFontWeight("bold");
    sheet.setFrozenRows(1);

    return "✅ สร้าง Header Dev Schema สำเร็จ เพราะ TaskData ว่าง";
  }

  const oldHeaders = values[0].map(h => String(h || "").trim());

  const oldIndex = {};
  oldHeaders.forEach((h, i) => {
    if (h && oldIndex[h] === undefined) {
      oldIndex[h] = i;
    }
  });

  function defaultValueForNewColumn(header) {
    if (header === "ResultText") return "-";
    if (header === "AchievementStatus") return "NoData";
    if (header === "AchievementText") return "ไม่มีข้อมูล";
    if (header === "InputStatus") return "NotSubmitted";
    return "";
  }

  const newValues = [];
  newValues.push(DEV_TASKDATA_HEADERS);

  for (let r = 1; r < values.length; r++) {
    const oldRow = values[r];

    const isEmptyRow = oldRow.every(cell =>
      cell === "" || cell === null || cell === undefined
    );

    if (isEmptyRow) continue;

    const newRow = DEV_TASKDATA_HEADERS.map(header => {
      if (oldIndex[header] !== undefined) {
        return oldRow[oldIndex[header]];
      }

      return defaultValueForNewColumn(header);
    });

    newValues.push(newRow);
  }

  // ✅ ปรับจำนวน column ให้พอ
  const currentMaxCols = sheet.getMaxColumns();
  if (currentMaxCols < DEV_TASKDATA_HEADERS.length) {
    sheet.insertColumnsAfter(
      currentMaxCols,
      DEV_TASKDATA_HEADERS.length - currentMaxCols
    );
  }

  // ✅ ปรับจำนวน row ให้พอ
  const currentMaxRows = sheet.getMaxRows();
  if (currentMaxRows < newValues.length) {
    sheet.insertRowsAfter(
      currentMaxRows,
      newValues.length - currentMaxRows
    );
  }

  // ✅ ล้างเฉพาะเนื้อหา แล้วเขียนข้อมูลใหม่ตาม schema Dev
  sheet.clearContents();

  sheet
    .getRange(1, 1, newValues.length, DEV_TASKDATA_HEADERS.length)
    .setValues(newValues);

  sheet
    .getRange(1, 1, 1, DEV_TASKDATA_HEADERS.length)
    .setFontWeight("bold");

  sheet.setFrozenRows(1);

  // ✅ ลบ column เกินหลัง schema Dev ถ้ามี
  const maxColsAfter = sheet.getMaxColumns();
  if (maxColsAfter > DEV_TASKDATA_HEADERS.length) {
    sheet.deleteColumns(
      DEV_TASKDATA_HEADERS.length + 1,
      maxColsAfter - DEV_TASKDATA_HEADERS.length
    );
  }

  return (
    "✅ ปรับ TaskData Master ให้เข้ากับ Dev Schema สำเร็จ\n" +
    "📌 จำนวนข้อมูลที่ย้าย: " + (newValues.length - 1) + " แถว\n" +
    "📌 จำนวนคอลัมน์ใหม่: " + DEV_TASKDATA_HEADERS.length + " คอลัมน์\n" +
    "📦 Backup: " + backupName
  );
}
            function clearMonthlyInputForActivePeriod() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("TaskData");

  if (!sheet) {
    throw new Error("ไม่พบชีต TaskData");
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return "ไม่มีข้อมูลให้ล้าง";
  }

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h || "").trim());

  const col = name => headers.indexOf(name);

  const columnsToClear = [
    "Progress",
    "ProgressOutcome",
    "ResultValue",
    "ResultLevelText",
    "ResultLevelRank",
    "TargetLevelText",
    "TargetLevelRank",
    "SubmittedAt",
    "SubmittedBy",
    "InputPeriodKey",
    "InputPeriodLabel"
  ];

  const columnsToDefault = {
    ResultText: "-",
    AchievementStatus: "NoData",
    AchievementText: "ไม่มีข้อมูล",
    InputStatus: "NotSubmitted"
  };

  const updatedAtCol = col("UpdatedAt");
  const inputStatusCol = col("InputStatus");

  let clearedCount = 0;
  const now = new Date();

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    // ✅ กันพลาด: ถ้ามีคนส่งข้อมูลแล้ว จะไม่ล้างแถวนั้น
    const inputStatus =
      inputStatusCol !== -1 ? String(row[inputStatusCol] || "").trim() : "";

    if (inputStatus === "Submitted") {
      continue;
    }

    columnsToClear.forEach(name => {
      const c = col(name);
      if (c !== -1) {
        row[c] = "";
      }
    });

    Object.keys(columnsToDefault).forEach(name => {
      const c = col(name);
      if (c !== -1) {
        row[c] = columnsToDefault[name];
      }
    });

    if (updatedAtCol !== -1) {
      row[updatedAtCol] = now;
    }

    clearedCount++;
  }

  sheet
    .getRange(1, 1, values.length, headers.length)
    .setValues(values);

  return "✅ ล้างช่องกรอกผลรายเดือนเรียบร้อย " + clearedCount + " รายการ";
}
