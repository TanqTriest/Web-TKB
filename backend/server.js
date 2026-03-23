const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { runSchema, query, get, run } = require("./db");
const { authRequired, adminOnly, JWT_SECRET } = require("./auth.middleware");
const { isOverlap, detectCourseConflicts } = require("./conflict.utils");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

runSchema();

async function seedAdmin() {
  const admin = await get("SELECT * FROM users WHERE username = ?", ["admin"]);
  if (!admin) {
    const hash = await bcrypt.hash("admin123", 10);
    await run(
      "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
      ["admin", hash, "System Admin", "admin"]
    );
    console.log("Seeded default admin: admin / admin123");
  }
}
seedAdmin();

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/* ================= AUTH ================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, fullName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Thiếu username hoặc password." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải từ 6 ký tự." });
    }

    const existed = await get("SELECT id FROM users WHERE username = ?", [username]);
    if (existed) {
      return res.status(409).json({ message: "Tên đăng nhập đã tồn tại." });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, 'user')",
      [username, hash, fullName || username]
    );

    const newUser = await get("SELECT id, username, full_name, role FROM users WHERE id = ?", [result.id]);
    const token = createToken(newUser);

    res.json({
      message: "Đăng ký thành công.",
      token,
      user: newUser
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await get("SELECT * FROM users WHERE username = ?", [username]);

    if (!user) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu." });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu." });
    }

    const token = createToken(user);

    res.json({
      message: "Đăng nhập thành công.",
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  const user = await get(
    "SELECT id, username, full_name, role, created_at FROM users WHERE id = ?",
    [req.user.id]
  );
  res.json(user);
});

/* ================= SLOTS ================= */

app.get("/api/slots", authRequired, async (req, res) => {
  const slots = await query("SELECT * FROM slots ORDER BY period ASC");
  res.json(slots);
});

app.post("/api/slots", authRequired, adminOnly, async (req, res) => {
  try {
    const { period, timeLabel } = req.body;

    if (!period || !timeLabel) {
      return res.status(400).json({ message: "Thiếu period hoặc timeLabel." });
    }

    const existed = await get("SELECT * FROM slots WHERE period = ?", [period]);
    if (existed) {
      await run("UPDATE slots SET time_label = ? WHERE period = ?", [timeLabel, period]);
      return res.json({ message: "Cập nhật tiết học thành công." });
    }

    await run("INSERT INTO slots (period, time_label) VALUES (?, ?)", [period, timeLabel]);
    res.json({ message: "Thêm tiết học thành công." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/slots/:period", authRequired, adminOnly, async (req, res) => {
  try {
    const period = Number(req.params.period);

    const used = await get(
      `SELECT cs.id
       FROM course_schedules cs
       WHERE ? BETWEEN cs.start_period AND (cs.start_period + cs.duration - 1)
       LIMIT 1`,
      [period]
    );

    if (used) {
      return res.status(400).json({ message: "Không thể xóa vì tiết đang được dùng trong lịch môn học." });
    }

    await run("DELETE FROM slots WHERE period = ?", [period]);
    res.json({ message: "Xóa tiết học thành công." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ================= COURSES ================= */

app.get("/api/courses", authRequired, async (req, res) => {
  try {
    const {
      keyword = "",
      sortBy = "course_code",
      sortOrder = "asc"
    } = req.query;

    const safeSortMap = {
      course_code: "c.course_code",
      course_name: "c.course_name",
      lecturer: "c.lecturer",
      day_of_week: "cs.day_of_week"
    };

    const sortColumn = safeSortMap[sortBy] || "c.course_code";
    const order = String(sortOrder).toLowerCase() === "desc" ? "DESC" : "ASC";

    const rows = await query(
      `SELECT
         c.id,
         c.course_code,
         c.course_name,
         c.lecturer,
         c.group_name,
         c.practice_group,
         c.color,
         c.note,
         cs.day_of_week,
         cs.start_period,
         cs.duration,
         cs.room_code
       FROM courses c
       JOIN course_schedules cs ON cs.course_id = c.id
       WHERE
         c.course_code LIKE ?
         OR c.course_name LIKE ?
         OR c.lecturer LIKE ?
       ORDER BY ${sortColumn} ${order}, cs.start_period ASC`,
      [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/courses", authRequired, adminOnly, async (req, res) => {
  try {
    const {
      courseCode,
      courseName,
      lecturer,
      groupName,
      practiceGroup,
      color,
      note,
      schedules
    } = req.body;

    if (!courseCode || !courseName || !lecturer || !groupName) {
      return res.status(400).json({ message: "Thiếu thông tin môn học." });
    }

    if (!Array.isArray(schedules) || !schedules.length) {
      return res.status(400).json({ message: "Phải có ít nhất 1 lịch học." });
    }

    const inserted = await run(
      `INSERT INTO courses
       (course_code, course_name, lecturer, group_name, practice_group, color, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        courseCode,
        courseName,
        lecturer,
        groupName,
        practiceGroup || "Không có",
        color || "#2563eb",
        note || "",
        req.user.id
      ]
    );

    for (const s of schedules) {
      await run(
        `INSERT INTO course_schedules
         (course_id, day_of_week, start_period, duration, room_code)
         VALUES (?, ?, ?, ?, ?)`,
        [inserted.id, s.dayOfWeek, s.startPeriod, s.duration, s.roomCode]
      );
    }

    res.json({ message: "Tạo môn học thành công.", id: inserted.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/courses/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const {
      courseCode,
      courseName,
      lecturer,
      groupName,
      practiceGroup,
      color,
      note,
      schedules
    } = req.body;

    await run(
      `UPDATE courses
       SET course_code = ?, course_name = ?, lecturer = ?, group_name = ?, practice_group = ?, color = ?, note = ?
       WHERE id = ?`,
      [
        courseCode,
        courseName,
        lecturer,
        groupName,
        practiceGroup || "Không có",
        color || "#2563eb",
        note || "",
        courseId
      ]
    );

    await run("DELETE FROM course_schedules WHERE course_id = ?", [courseId]);

    for (const s of schedules) {
      await run(
        `INSERT INTO course_schedules
         (course_id, day_of_week, start_period, duration, room_code)
         VALUES (?, ?, ?, ?, ?)`,
        [courseId, s.dayOfWeek, s.startPeriod, s.duration, s.roomCode]
      );
    }

    res.json({ message: "Cập nhật môn học thành công." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/courses/:id", authRequired, adminOnly, async (req, res) => {
  try {
    await run("DELETE FROM courses WHERE id = ?", [req.params.id]);
    res.json({ message: "Xóa môn học thành công." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ================= CONFLICT REPORT ================= */

app.get("/api/admin/conflicts", authRequired, adminOnly, async (req, res) => {
  try {
    const schedules = await query(
      `SELECT
         c.id AS course_id,
         c.course_code,
         c.course_name,
         c.lecturer,
         c.group_name,
         c.practice_group,
         cs.day_of_week,
         cs.start_period,
         cs.duration,
         cs.room_code
       FROM courses c
       JOIN course_schedules cs ON cs.course_id = c.id
       ORDER BY cs.day_of_week, cs.start_period`
    );

    const conflicts = detectCourseConflicts(schedules);
    res.json(conflicts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ================= REGISTRATIONS ================= */

app.get("/api/my/registrations", authRequired, async (req, res) => {
  try {
    const rows = await query(
      `SELECT
         r.id AS registration_id,
         c.id AS course_id,
         c.course_code,
         c.course_name,
         c.lecturer,
         c.group_name,
         c.practice_group,
         c.color,
         c.note,
         cs.day_of_week,
         cs.start_period,
         cs.duration,
         cs.room_code
       FROM registrations r
       JOIN courses c ON c.id = r.course_id
       JOIN course_schedules cs ON cs.course_id = c.id
       WHERE r.user_id = ?
       ORDER BY cs.day_of_week, cs.start_period`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/my/registrations", authRequired, async (req, res) => {
  try {
    const { courseId } = req.body;
    const newSchedules = await query(
      `SELECT c.id, c.course_code, c.course_name, cs.day_of_week, cs.start_period, cs.duration
       FROM courses c
       JOIN course_schedules cs ON cs.course_id = c.id
       WHERE c.id = ?`,
      [courseId]
    );

    if (!newSchedules.length) {
      return res.status(404).json({ message: "Không tìm thấy môn học." });
    }

    const current = await query(
      `SELECT c.id, c.course_code, c.course_name, cs.day_of_week, cs.start_period, cs.duration
       FROM registrations r
       JOIN courses c ON c.id = r.course_id
       JOIN course_schedules cs ON cs.course_id = c.id
       WHERE r.user_id = ?`,
      [req.user.id]
    );

    for (const ns of newSchedules) {
      for (const cs of current) {
        if (
          ns.day_of_week === cs.day_of_week &&
          isOverlap(ns.start_period, ns.duration, cs.start_period, cs.duration)
        ) {
          return res.status(400).json({
            message: `Trùng lịch với môn ${cs.course_code} - ${cs.course_name}.`
          });
        }
      }
    }

    await run(
      "INSERT OR IGNORE INTO registrations (user_id, course_id) VALUES (?, ?)",
      [req.user.id, courseId]
    );

    res.json({ message: "Đăng ký môn học thành công." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/my/registrations/:courseId", authRequired, async (req, res) => {
  try {
    await run(
      "DELETE FROM registrations WHERE user_id = ? AND course_id = ?",
      [req.user.id, req.params.courseId]
    );
    res.json({ message: "Hủy đăng ký môn học thành công." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});