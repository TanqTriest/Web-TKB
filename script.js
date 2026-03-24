(() => {
  "use strict";

  const API_BASE = "https://web-tkb.onrender.com/api";

  const DAY_MAP = {
    2: "Thứ 2",
    3: "Thứ 3",
    4: "Thứ 4",
    5: "Thứ 5",
    6: "Thứ 6",
    7: "Thứ 7",
    8: "Chủ nhật"
  };

  const state = {
    theme: localStorage.getItem("tkb_theme_v3") || "light",
    mode: "user",
    token: localStorage.getItem("tkb_token") || "",
    currentUser: null,
    slots: [],
    courses: [],
    selectedCourses: [],
    keyword: "",
    sortBy: "course_code",
    sortOrder: "asc"
    scheduleDrafts: [],
  };

  const els = {
    modeChip: document.getElementById("modeChip"),
    headerStatus: document.getElementById("headerStatus"),
    switchModeBtn: document.getElementById("switchModeBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    printBtn: document.getElementById("printBtn"),

    adminSection: document.getElementById("adminSection"),
    userSection: document.getElementById("userSection"),

    slotForm: document.getElementById("slotForm"),
    slotPeriod: document.getElementById("slotPeriod"),
    slotTime: document.getElementById("slotTime"),
    slotTableBody: document.getElementById("slotTableBody"),

    courseForm: document.getElementById("courseForm"),
    courseId: document.getElementById("courseId"),
    courseCode: document.getElementById("courseCode"),
    courseName: document.getElementById("courseName"),
    lecturer: document.getElementById("lecturer"),
    groupName: document.getElementById("groupName"),
    practiceGroup: document.getElementById("practiceGroup"),
    addScheduleBtn: document.getElementById("addScheduleBtn"),
    scheduleRows: document.getElementById("scheduleRows"),
    courseColor: document.getElementById("courseColor"),
    note: document.getElementById("note"),
    courseSubmitBtn: document.getElementById("courseSubmitBtn"),
    resetCourseFormBtn: document.getElementById("resetCourseFormBtn"),
    courseTableBody: document.getElementById("courseTableBody"),

    globalCourseSearchInput: document.getElementById("globalCourseSearchInput"),
    globalSortBy: document.getElementById("globalSortBy"),
    globalSortOrder: document.getElementById("globalSortOrder"),

    currentUserText: document.getElementById("currentUserText"),
    openRegisterModalBtn: document.getElementById("openRegisterModalBtn"),
    openLoginModalBtn: document.getElementById("openLoginModalBtn"),
    logoutBtn: document.getElementById("logoutBtn"),

    registerModal: document.getElementById("registerModal"),
    registerForm: document.getElementById("registerForm"),
    registerFullName: document.getElementById("registerFullName"),
    registerUsername: document.getElementById("registerUsername"),
    registerPassword: document.getElementById("registerPassword"),
    closeRegisterModalBtn: document.getElementById("closeRegisterModalBtn"),
    cancelRegisterModalBtn: document.getElementById("cancelRegisterModalBtn"),

    loginModal: document.getElementById("loginModal"),
    loginForm: document.getElementById("loginForm"),
    loginUsername: document.getElementById("loginUsername"),
    loginPassword: document.getElementById("loginPassword"),
    closeLoginModalBtn: document.getElementById("closeLoginModalBtn"),
    cancelLoginModalBtn: document.getElementById("cancelLoginModalBtn"),

    courseOptionList: document.getElementById("courseOptionList"),
    selectedSummary: document.getElementById("selectedSummary"),
    scheduleStats: document.getElementById("scheduleStats"),
    timetable: document.getElementById("timetable"),

    adminConflictCard: document.getElementById("adminConflictCard"),
    conflictList: document.getElementById("conflictList"),
    reloadConflictBtn: document.getElementById("reloadConflictBtn"),

    toastContainer: document.getElementById("toastContainer")
  };

  function escapeHtml(value) {
    function createEmptySchedule() {
      return {
        dayOfWeek: 2,
        startPeriod: state.slots[0]?.period || 1,
        duration: 2,
        roomCode: ""
      };
    }
    function renderScheduleRows() {
      if (!els.scheduleRows) return;
    
      if (!state.scheduleDrafts.length) {
        state.scheduleDrafts = [createEmptySchedule()];
      }
    
      els.scheduleRows.innerHTML = state.scheduleDrafts.map((s, i) => `
        <div class="schedule-row">
          <div class="schedule-row-head">
            <div>Buổi ${i + 1}</div>
            <button type="button" data-remove="${i}">Xóa</button>
          </div>
    
          <div>
            Thứ:
            <select data-i="${i}" data-f="dayOfWeek">
              ${Object.entries(DAY_MAP).map(([k, v]) =>
                `<option value="${k}" ${Number(s.dayOfWeek) === Number(k) ? "selected" : ""}>${v}</option>`
              ).join("")}
            </select>
    
            Tiết:
            <input type="number" value="${s.startPeriod}" data-i="${i}" data-f="startPeriod" />
    
            Số tiết:
            <input type="number" value="${s.duration}" data-i="${i}" data-f="duration" />
    
            Phòng:
            <input type="text" value="${s.roomCode}" data-i="${i}" data-f="roomCode" />
          </div>
        </div>
      `).join("");
    
      els.scheduleRows.querySelectorAll("[data-f]").forEach(el => {
        el.addEventListener("input", e => {
          const i = e.target.dataset.i;
          const f = e.target.dataset.f;
          state.scheduleDrafts[i][f] = e.target.value;
        });
      });
    
      els.scheduleRows.querySelectorAll("[data-remove]").forEach(btn => {
        btn.onclick = () => {
          state.scheduleDrafts.splice(btn.dataset.remove, 1);
          renderScheduleRows();
        };
      });
    }
    
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-6px)";
    }, 2500);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  async function api(url, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Có lỗi xảy ra.");
    }

    return data;
  }

  function openModal(modal) {
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function applyTheme() {
    document.body.classList.toggle("dark", state.theme === "dark");
    localStorage.setItem("tkb_theme_v3", state.theme);
    els.themeToggleBtn.textContent =
      state.theme === "dark" ? "☀️ Chế độ sáng" : "🌙 Chế độ tối";
  }

  function applyMode() {
    const isAdmin = state.mode === "admin";
    els.modeChip.textContent = isAdmin ? "ADMIN MODE" : "USER MODE";
    els.headerStatus.textContent = isAdmin ? "Đang ở Admin mode" : "Đang ở User mode";
    els.switchModeBtn.textContent = isAdmin ? "Quay về User" : "Chuyển sang Admin";
    els.adminSection.classList.toggle("hidden", !isAdmin);
  }

  function applyAuthUI() {
    if (!state.currentUser) {
      els.currentUserText.textContent = "Bạn chưa đăng nhập.";
      els.openRegisterModalBtn.classList.remove("hidden");
      els.openLoginModalBtn.classList.remove("hidden");
      els.logoutBtn.classList.add("hidden");
      state.mode = "user";
      applyMode();
      return;
    }

    const roleText = state.currentUser.role === "admin" ? "Admin" : "User";
    els.currentUserText.innerHTML = `
      Xin chào, <strong>${escapeHtml(state.currentUser.full_name || state.currentUser.username)}</strong>
      <span class="badge-role">${roleText}</span>
    `;

    els.openRegisterModalBtn.classList.add("hidden");
    els.openLoginModalBtn.classList.add("hidden");
    els.logoutBtn.classList.remove("hidden");
  }

  async function loadMe() {
    if (!state.token) {
      state.currentUser = null;
      return;
    }

    try {
      state.currentUser = await api("/auth/me");
    } catch (error) {
      state.currentUser = null;
      state.token = "";
      localStorage.removeItem("tkb_token");
    }
  }

  async function loadSlots() {
    if (!state.token) {
      state.slots = [];
      return;
    }
    state.slots = await api("/slots");
  }

  async function loadCourses() {
    if (!state.token) {
      state.courses = [];
      return;
    }

    const params = new URLSearchParams({
      keyword: state.keyword,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder
    });

    state.courses = await api(`/courses?${params.toString()}`);
  }

  async function loadMyRegistrations() {
    if (!state.token) {
      state.selectedCourses = [];
      return;
    }

    state.selectedCourses = await api("/my/registrations");
  }

  async function loadConflicts() {
    if (!state.currentUser || state.currentUser.role !== "admin") {
      els.conflictList.innerHTML = `<div class="selected-empty">Bạn không có quyền xem dữ liệu admin.</div>`;
      return;
    }

    try {
      const conflicts = await api("/admin/conflicts");

      if (!conflicts.length) {
        els.conflictList.innerHTML = `<div class="selected-empty">Không phát hiện xung đột nào.</div>`;
        return;
      }

      els.conflictList.innerHTML = conflicts.map(item => `
        <div class="conflict-item">
          <h4>${escapeHtml(item.type)}</h4>
          <p>${escapeHtml(item.message)}</p>
        </div>
      `).join("");
    } catch (error) {
      els.conflictList.innerHTML = `<div class="selected-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  

  function renderSlotTable() {
    if (!state.slots.length) {
      els.slotTableBody.innerHTML = `<tr><td colspan="2">Chưa có dữ liệu tiết học.</td></tr>`;
      return;
    }

    els.slotTableBody.innerHTML = state.slots
      .slice()
      .sort((a, b) => a.period - b.period)
      .map(slot => `
        <tr>
          <td>${slot.period}</td>
          <td>${escapeHtml(slot.time_label)}</td>
        </tr>
      `).join("");
  }

  function renderAdminCourseTable() {
    if (!state.courses.length) {
      els.courseTableBody.innerHTML = `<tr><td colspan="12">Không có môn học.</td></tr>`;
      return;
    }

    els.courseTableBody.innerHTML = state.courses.map(course => `
      <tr>
        <td><div class="color-dot" style="background:${escapeHtml(course.color)}"></div></td>
        <td>${escapeHtml(course.course_code)}</td>
        <td>${escapeHtml(course.course_name)}</td>
        <td>${escapeHtml(course.lecturer)}</td>
        <td>${escapeHtml(course.group_name)}</td>
        <td>${escapeHtml(course.practice_group)}</td>
        <td>${escapeHtml(DAY_MAP[course.day_of_week])}</td>
        <td>Tiết ${course.start_period}</td>
        <td>${course.duration}</td>
        <td>${escapeHtml(course.room_code)}</td>
        <td>${escapeHtml(course.note || "-")}</td>
        <td>
          <div class="action-group">
            <button class="mini-btn mini-edit" data-edit-id="${course.id}">Sửa</button>
            <button class="mini-btn mini-delete" data-delete-id="${course.id}">Xóa</button>
          </div>
        </td>
      </tr>
    `).join("");

    els.courseTableBody.querySelectorAll("[data-edit-id]").forEach(btn => {
      btn.addEventListener("click", () => editCourse(Number(btn.dataset.editId)));
    });

    els.courseTableBody.querySelectorAll("[data-delete-id]").forEach(btn => {
      btn.addEventListener("click", () => deleteCourse(Number(btn.dataset.deleteId)));
    });
  }

  function renderUserCourseOptions() {
    if (!state.currentUser) {
      els.courseOptionList.innerHTML = `<div class="selected-empty">Hãy đăng nhập để đăng ký môn học.</div>`;
      return;
    }

    if (!state.courses.length) {
      els.courseOptionList.innerHTML = `<div class="selected-empty">Chưa có môn học nào.</div>`;
      return;
    }

    const selectedIds = new Set(state.selectedCourses.map(item => Number(item.course_id)));

    els.courseOptionList.innerHTML = state.courses.map(course => {
      const checked = selectedIds.has(Number(course.id));

      return `
        <label class="course-item ${checked ? "selected" : ""}">
          <div class="course-color-bar" style="background:${escapeHtml(course.color)}"></div>
          <div class="course-main">
            <h4>${escapeHtml(course.course_code)} - ${escapeHtml(course.course_name)}</h4>
            <p><strong>GV:</strong> ${escapeHtml(course.lecturer)}</p>
            <p><strong>Nhóm:</strong> ${escapeHtml(course.group_name)} | <strong>Tổ TH:</strong> ${escapeHtml(course.practice_group)}</p>
            <p><strong>Lịch:</strong> ${escapeHtml(DAY_MAP[course.day_of_week])}, tiết ${course.start_period} (${course.duration} tiết)</p>
            <p><strong>Phòng:</strong> ${escapeHtml(course.room_code)}</p>
            ${course.note ? `<p><strong>Ghi chú:</strong> ${escapeHtml(course.note)}</p>` : ""}
          </div>
          <div class="course-check">
            <input type="checkbox" data-course-id="${course.id}" ${checked ? "checked" : ""} />
          </div>
        </label>
      `;
    }).join("");

    els.courseOptionList.querySelectorAll("[data-course-id]").forEach(input => {
      input.addEventListener("change", async () => {
        await toggleCourseSelection(Number(input.dataset.courseId), input.checked);
      });
    });
  }

  function renderSelectedSummary() {
    if (!state.selectedCourses.length) {
      els.selectedSummary.innerHTML = `<div class="selected-empty">Bạn chưa chọn môn nào.</div>`;
      els.scheduleStats.innerHTML = `
        <div class="stat-chip">0 môn đã chọn</div>
        <div class="stat-chip">0 tiết / tuần</div>
      `;
      return;
    }

    const totalPeriods = state.selectedCourses.reduce((sum, course) => sum + Number(course.duration || 0), 0);

    els.selectedSummary.innerHTML = state.selectedCourses.map(course => `
      <div class="selected-pill" style="background:${escapeHtml(course.color)}">
        <strong>${escapeHtml(course.course_code)} - ${escapeHtml(course.course_name)}</strong>
        <div>${escapeHtml(DAY_MAP[course.day_of_week])}, tiết ${course.start_period} (${course.duration} tiết)</div>
        <div>GV: ${escapeHtml(course.lecturer)} | Phòng: ${escapeHtml(course.room_code)}</div>
      </div>
    `).join("");

    els.scheduleStats.innerHTML = `
      <div class="stat-chip">${state.selectedCourses.length} môn đã chọn</div>
      <div class="stat-chip">${totalPeriods} tiết / tuần</div>
    `;
  }

  function renderTimetable() {
    if (!state.slots.length) {
      els.timetable.innerHTML = `
        <thead><tr><th>Thông báo</th></tr></thead>
        <tbody><tr><td>Chưa có dữ liệu tiết học.</td></tr></tbody>
      `;
      return;
    }

    const slots = state.slots.slice().sort((a, b) => a.period - b.period);
    const days = [2, 3, 4, 5, 6, 7, 8];

    const grid = {};
    const skipMap = {};

    days.forEach(day => {
      grid[day] = {};
      skipMap[day] = {};
      slots.forEach(slot => {
        grid[day][slot.period] = null;
        skipMap[day][slot.period] = false;
      });
    });

    state.selectedCourses.forEach(course => {
      const day = Number(course.day_of_week);
      const start = Number(course.start_period);
      const duration = Number(course.duration);

      grid[day][start] = course;

      for (let p = start + 1; p <= start + duration - 1; p++) {
        skipMap[day][p] = true;
      }
    });

    const thead = `
      <thead>
        <tr>
          <th class="period-col">Tiết</th>
          <th class="time-col">Khung giờ</th>
          ${days.map(day => `<th>${DAY_MAP[day]}</th>`).join("")}
        </tr>
      </thead>
    `;

    let tbody = "<tbody>";

    for (const slot of slots) {
      tbody += "<tr>";
      tbody += `<td class="period-col">${slot.period}</td>`;
      tbody += `<td class="time-col">${escapeHtml(slot.time_label)}</td>`;

      for (const day of days) {
        if (skipMap[day][slot.period]) {
          continue;
        }

        const course = grid[day][slot.period];

        if (!course) {
          tbody += `<td></td>`;
        } else {
          const duration = Number(course.duration);
          tbody += `
            <td rowspan="${duration}">
              <div class="schedule-block" style="background:${escapeHtml(course.color)}">
                <div class="code">${escapeHtml(course.course_code)}</div>
                <div class="name">${escapeHtml(course.course_name)}</div>
                <div class="meta">
                  GV: ${escapeHtml(course.lecturer)}<br>
                  Nhóm: ${escapeHtml(course.group_name)} | Tổ TH: ${escapeHtml(course.practice_group)}<br>
                  Phòng: ${escapeHtml(course.room_code)}<br>
                  Tiết: ${course.start_period} - ${Number(course.start_period) + duration - 1}
                </div>
              </div>
            </td>
          `;
        }
      }

      tbody += "</tr>";
    }

    tbody += "</tbody>";
    els.timetable.innerHTML = thead + tbody;
  }

  function collectCoursePayload() {
    return {
      courseCode: els.courseCode.value.trim(),
      courseName: els.courseName.value.trim(),
      lecturer: els.lecturer.value.trim(),
      groupName: els.groupName.value.trim(),
      practiceGroup: els.practiceGroup.value.trim(),
      color: els.courseColor.value,
      note: els.note.value.trim(),
      schedules: state.scheduleDrafts.map(s => ({
        dayOfWeek: Number(s.dayOfWeek),
        startPeriod: Number(s.startPeriod),
        duration: Number(s.duration),
        roomCode: s.roomCode
      }))
    };
  }

  function resetCourseForm() {
    els.courseForm.reset();
    els.courseId.value = "";
    els.duration.value = 2;
    els.courseColor.value = "#2563eb";
    els.courseSubmitBtn.textContent = "Lưu lớp học phần";
    state.scheduleDrafts = [createEmptySchedule()];
    renderScheduleRows();
  }

  function getCourseById(id) {
    return state.courses.find(course => Number(course.id) === Number(id));
  }

  function editCourse(id) {
    const course = getCourseById(id);
    if (!course) return;

    els.courseId.value = course.id;
    els.courseCode.value = course.course_code;
    els.courseName.value = course.course_name;
    els.lecturer.value = course.lecturer;
    els.groupName.value = course.group_name;
    els.practiceGroup.value = course.practice_group;
    els.dayOfWeek.value = String(course.day_of_week);
    els.startPeriod.value = String(course.start_period);
    els.duration.value = String(course.duration);
    els.roomCode.value = course.room_code;
    els.courseColor.value = course.color || "#2563eb";
    els.note.value = course.note || "";
    els.courseSubmitBtn.textContent = "Cập nhật lớp học phần";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function deleteCourse(id) {
    try {
      const ok = window.confirm("Bạn có chắc muốn xóa môn học này?");
      if (!ok) return;

      await api(`/courses/${id}`, {
        method: "DELETE"
      });

      await reloadAppData();
      if (state.mode === "admin") {
        await loadConflicts();
      }
      showToast("Xóa môn học thành công.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function toggleCourseSelection(courseId, checked) {
    try {
      if (!state.currentUser) {
        showToast("Bạn cần đăng nhập trước.", "warning");
        openModal(els.loginModal);
        return;
      }

      if (checked) {
        await api("/my/registrations", {
          method: "POST",
          body: JSON.stringify({ courseId })
        });
      } else {
        await api(`/my/registrations/${courseId}`, {
          method: "DELETE"
        });
      }

      await loadMyRegistrations();
      renderUserCourseOptions();
      renderSelectedSummary();
      renderTimetable();

      showToast(
        checked ? "Đăng ký môn học thành công." : "Đã hủy đăng ký môn học.",
        "success"
      );
    } catch (error) {
      showToast(error.message, "error");
      await loadMyRegistrations();
      renderUserCourseOptions();
      renderSelectedSummary();
      renderTimetable();
    }
  }

  async function reloadAppData() {
    await loadSlots();
    await loadCourses();
    await loadMyRegistrations();
    
    renderSlotTable();
    renderAdminCourseTable();
    renderUserCourseOptions();
    renderSelectedSummary();
    renderTimetable();
  }

  async function handleRegister(event) {
    event.preventDefault();

    try {
      const payload = {
        fullName: els.registerFullName.value.trim(),
        username: els.registerUsername.value.trim(),
        password: els.registerPassword.value
      };

      const data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      state.token = data.token;
      state.currentUser = data.user;
      localStorage.setItem("tkb_token", state.token);

      closeModal(els.registerModal);
      els.registerForm.reset();
      applyAuthUI();
      await reloadAppData();
      showToast("Tạo tài khoản thành công.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    try {
      const payload = {
        username: els.loginUsername.value.trim(),
        password: els.loginPassword.value
      };

      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      state.token = data.token;
      state.currentUser = data.user;
      localStorage.setItem("tkb_token", state.token);

      closeModal(els.loginModal);
      els.loginForm.reset();
      applyAuthUI();
      await reloadAppData();
      showToast("Đăng nhập thành công.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function logout() {
    state.token = "";
    state.currentUser = null;
    state.selectedCourses = [];
    state.courses = [];
    state.slots = [];
    state.mode = "user";
    localStorage.removeItem("tkb_token");
    applyAuthUI();
    
    renderSlotTable();
    renderAdminCourseTable();
    renderUserCourseOptions();
    renderSelectedSummary();
    renderTimetable();
    showToast("Đã đăng xuất.", "success");
  }

  async function handleSlotSubmit(event) {
    event.preventDefault();

    try {
      await api("/slots", {
        method: "POST",
        body: JSON.stringify({
          period: Number(els.slotPeriod.value),
          timeLabel: els.slotTime.value.trim()
        })
      });

      els.slotForm.reset();
      await reloadAppData();
      showToast("Lưu tiết học thành công.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleCourseSubmit(event) {
    event.preventDefault();

    try {
      const payload = collectCoursePayload();
      const editingId = els.courseId.value.trim();

      if (editingId) {
        await api(`/courses/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await api("/courses", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      resetCourseForm();
      await reloadAppData();
      if (state.mode === "admin") {
        await loadConflicts();
      }
      showToast("Lưu môn học thành công.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function bindEvents() {
    els.themeToggleBtn.addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      applyTheme();
    });
    
    els.addScheduleBtn.addEventListener("click", () => {
      state.scheduleDrafts.push(createEmptySchedule());
      renderScheduleRows();
    });
    
    els.switchModeBtn.addEventListener("click", async () => {
      if (!state.currentUser) {
        showToast("Bạn cần đăng nhập trước.", "warning");
        openModal(els.loginModal);
        return;
      }

      if (state.mode === "admin") {
        state.mode = "user";
        applyMode();
        return;
      }

      if (state.currentUser.role !== "admin") {
        showToast("Tài khoản này không có quyền admin.", "error");
        return;
      }

      state.mode = "admin";
      applyMode();
      await loadConflicts();
    });

    els.printBtn.addEventListener("click", () => window.print());

    els.openRegisterModalBtn.addEventListener("click", () => openModal(els.registerModal));
    els.openLoginModalBtn.addEventListener("click", () => openModal(els.loginModal));
    els.logoutBtn.addEventListener("click", logout);

    els.closeRegisterModalBtn.addEventListener("click", () => closeModal(els.registerModal));
    els.cancelRegisterModalBtn.addEventListener("click", () => closeModal(els.registerModal));
    els.closeLoginModalBtn.addEventListener("click", () => closeModal(els.loginModal));
    els.cancelLoginModalBtn.addEventListener("click", () => closeModal(els.loginModal));

    els.registerModal.querySelector(".modal-backdrop").addEventListener("click", () => closeModal(els.registerModal));
    els.loginModal.querySelector(".modal-backdrop").addEventListener("click", () => closeModal(els.loginModal));

    els.registerForm.addEventListener("submit", handleRegister);
    els.loginForm.addEventListener("submit", handleLogin);

    els.slotForm.addEventListener("submit", handleSlotSubmit);
    els.courseForm.addEventListener("submit", handleCourseSubmit);

    els.resetCourseFormBtn.addEventListener("click", resetCourseForm);

    els.globalCourseSearchInput.addEventListener("input", async event => {
      state.keyword = event.target.value.trim();
      await loadCourses();
      renderAdminCourseTable();
      renderUserCourseOptions();
    });

    els.globalSortBy.addEventListener("change", async event => {
      state.sortBy = event.target.value;
      await loadCourses();
      renderAdminCourseTable();
      renderUserCourseOptions();
    });

    els.globalSortOrder.addEventListener("change", async event => {
      state.sortOrder = event.target.value;
      await loadCourses();
      renderAdminCourseTable();
      renderUserCourseOptions();
    });

    els.reloadConflictBtn.addEventListener("click", loadConflicts);
  }

  async function init() {
    bindEvents();
    applyTheme();
    await loadMe();
    applyAuthUI();
    applyMode();
    state.scheduleDrafts = [createEmptySchedule()];
    await reloadAppData();
    renderScheduleRows();
    
    if (state.currentUser && state.currentUser.role === "admin" && state.mode === "admin") {
      await loadConflicts();
    }
  }

  init();
})();
