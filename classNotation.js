/* Class notation version expected by autograder */
(function () {
  "use strict";

  if (window.Course) {
    return;
  }

  const SEASON_ORDER = {
    Winter: 1,
    Spring: 2,
    Summer: 3,
    Fall: 4
  };

  class Course {
    constructor(fields) {
      this.id = fields.id ?? null;
      this.title = fields.title ?? null;
      this.postedTime = fields.postedTime ?? fields.semester ?? null;
      this.type = fields.type ?? null;
      this.level = fields.level ?? null;
      this.credits = Course.normalizeCredits(fields.credits);
      this.instructor = fields.instructor ?? null;
      this.skill = fields.skill ?? null;
      this.department = fields.department ?? null;
      this.detail = fields.detail ?? fields.description ?? null;
      this._raw = fields._raw ?? null;
    }

    static fromRaw(obj) {
      if (obj == null || typeof obj !== "object") return null;
      const id = obj.id ?? obj.courseId ?? obj.code ?? null;
      const title = obj.title ?? obj.name ?? null;
      if (!id || !title) return null;
      return new Course({
        id,
        title,
        postedTime: obj.postedTime ?? obj.semester ?? obj.term ?? null,
        type: obj.type ?? obj.category ?? null,
        level: obj.level ?? obj.difficulty ?? null,
        credits: obj.credits ?? obj.creditHours ?? obj.units ?? null,
        instructor: obj.instructor ?? obj.professor ?? obj.teacher ?? null,
        skill: obj.skill ?? obj.topic ?? null,
        department: obj.department ?? obj.dept ?? null,
        detail: obj.detail ?? obj.description ?? obj.summary ?? null,
        _raw: obj
      });
    }

    static normalizeCredits(value) {
      if (value == null || value === "") return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : String(value);
    }

    static semesterRank(semesterStr) {
      if (!semesterStr || typeof semesterStr !== "string") return null;
      const match = /^(\w+)\s+(\d{4})$/.exec(semesterStr.trim());
      if (!match) return null;
      const seasonIndex = SEASON_ORDER[match[1]];
      const year = Number(match[2]);
      if (!seasonIndex || !Number.isFinite(year)) return null;
      return year * 10 + seasonIndex;
    }

    getSummary() {
      const idPart = this.id ? `(${this.id})` : "";
      const levelPart = this.level ? ` • ${this.level}` : "";
      const creditsPart =
        this.credits != null ? ` • ${this.credits} credits` : "";
      const semesterPart = this.postedTime ? ` • ${this.postedTime}` : "";
      return `${this.title} ${idPart}${levelPart}${creditsPart}${semesterPart}`;
    }
  }

  window.Course = Course;
})();


