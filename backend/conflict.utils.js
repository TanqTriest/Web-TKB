function isOverlap(startA, durationA, startB, durationB) {
  const endA = startA + durationA - 1;
  const endB = startB + durationB - 1;
  return !(endA < startB || endB < startA);
}

function overlapRange(a, b) {
  const start = Math.max(a.start_period, b.start_period);
  const end = Math.min(
    a.start_period + a.duration - 1,
    b.start_period + b.duration - 1
  );
  return start === end ? `${start}` : `${start}-${end}`;
}

function detectCourseConflicts(schedules) {
  const results = [];

  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const a = schedules[i];
      const b = schedules[j];

      if (a.day_of_week !== b.day_of_week) continue;
      if (!isOverlap(a.start_period, a.duration, b.start_period, b.duration)) continue;

      if (a.lecturer === b.lecturer) {
        results.push({
          type: "LECTURER_CONFLICT",
          message: `Giảng viên ${a.lecturer} bị trùng lịch giữa ${a.course_code} và ${b.course_code}, thứ ${a.day_of_week}, tiết ${overlapRange(a, b)}.`,
          a,
          b
        });
      }

      if (a.room_code === b.room_code) {
        results.push({
          type: "ROOM_CONFLICT",
          message: `Phòng ${a.room_code} bị trùng giữa ${a.course_code} và ${b.course_code}, thứ ${a.day_of_week}, tiết ${overlapRange(a, b)}.`,
          a,
          b
        });
      }

      if (
        a.lecturer === b.lecturer &&
        a.room_code !== b.room_code
      ) {
        results.push({
          type: "MULTI_ROOM_LECTURER_CONFLICT",
          message: `Giảng viên ${a.lecturer} đang bị xếp dạy cùng lúc ở 2 phòng khác nhau (${a.room_code} / ${b.room_code}) cho ${a.course_code} và ${b.course_code}.`,
          a,
          b
        });
      }
    }
  }

  return results;
}

module.exports = {
  isOverlap,
  detectCourseConflicts
};