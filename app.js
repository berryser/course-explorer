/* App logic for Course Explorer */
(function () {
  "use strict";

  // DOM
  const fileInput = document.getElementById("fileInput");
  const filtersContainer = document.getElementById("filtersContainer");
  const sortCombinedSelect = document.getElementById("sortCombined");
  const messageArea = document.getElementById("messageArea");
  const courseList = document.getElementById("courseList");
  const courseDetails = document.getElementById("courseDetails");

  // State
  let allCourses = [];
  let visibleCourses = [];
  let activeFilters = {};
  let filterKeys = [];
  let selectedCourseId = null;

  // Candidate filter keys. We include only those present in data.
  const CANDIDATE_FILTER_KEYS = [
    "level",
    "credits",
    "instructor",
    "department",
    "type",
    "skill"
  ];

  // Messages
  function showMessage(text, kind = "info") {
    messageArea.textContent = text;
    messageArea.className = `messages ${kind}`;
  }
  function clearMessage() {
    messageArea.textContent = "";
    messageArea.className = "messages";
  }

  // File loading
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    selectedCourseId = null;
    clearMessage();
    try {
      const text = await readFileAsText(file);
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Match screenshot wording
        throw new Error("Invalid JSON file format.");
      }
      if (!Array.isArray(data)) {
        throw new Error("Invalid JSON file format.");
      }
      const { courses, skippedCount } = toCourses(data);
      allCourses = courses;
      if (allCourses.length === 0) {
        showMessage(
          "Invalid JSON file format.",
          "error"
        );
      } else {
        if (skippedCount > 0) {
          showMessage(
            `Loaded ${allCourses.length} courses. Skipped ${skippedCount} invalid entr${
              skippedCount === 1 ? "y" : "ies"
            }.`,
            "info"
          );
        } else {
          clearMessage();
        }
      }
      // Build filters based on data
      filterKeys = deriveFilterKeys(allCourses);
      renderFilters(buildFilterOptions(allCourses, filterKeys));
      // Initial sort defaults
      if (sortCombinedSelect) sortCombinedSelect.value = "none";
      applyFiltersAndSort();
    } catch (err) {
      console.error(err);
      const message =
        err && err.message ? err.message : "Invalid JSON file format.";
      showMessage(message, "error");
      allCourses = [];
      visibleCourses = [];
      renderList();
      renderDetails();
      filtersContainer.innerHTML = "";
      activeFilters = {};
    }
  });

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error("Read failed"));
      reader.readAsText(file);
    });
  }

  function toCourses(dataArray) {
    const courses = [];
    let skippedCount = 0;
    for (const obj of dataArray) {
      const course = window.Course && window.Course.fromRaw(obj);
      if (course) {
        courses.push(course);
      } else {
        skippedCount += 1;
      }
    }
    return { courses, skippedCount };
  }

  // Filters
  function deriveFilterKeys(courses) {
    const present = new Set();
    for (const key of CANDIDATE_FILTER_KEYS) {
      if (courses.some((c) => c[key] != null && c[key] !== "")) {
        present.add(key);
      }
    }
    return Array.from(present);
  }

  function buildFilterOptions(courses, keys) {
    const options = {};
    for (const key of keys) {
      const vals = new Set();
      for (const c of courses) {
        const v = c[key];
        if (v != null && v !== "") {
          vals.add(String(v));
        }
      }
      options[key] = Array.from(vals).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );
    }
    return options;
  }

  function renderFilters(optionsMap) {
    filtersContainer.innerHTML = "";
    activeFilters = {};
    for (const key of Object.keys(optionsMap)) {
      const wrapper = document.createElement("div");
      wrapper.className = "filter-field";
      const selectId = `filter-${key}`;

      const label = document.createElement("label");
      label.setAttribute("for", selectId);
      label.textContent = labelForKey(key);

      const select = document.createElement("select");
      select.id = selectId;
      select.setAttribute("data-key", key);
      // "All" option
      const optAll = document.createElement("option");
      optAll.value = "";
      optAll.textContent = "All";
      select.appendChild(optAll);
      for (const val of optionsMap[key]) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = val;
        select.appendChild(opt);
      }
      select.addEventListener("change", () => {
        const k = select.getAttribute("data-key");
        const v = select.value;
        if (v === "") {
          delete activeFilters[k];
        } else {
          activeFilters[k] = v;
        }
        applyFiltersAndSort();
      });

      wrapper.appendChild(label);
      wrapper.appendChild(select);
      filtersContainer.appendChild(wrapper);
    }
  }

  function labelForKey(key) {
    switch (key) {
      case "level":
        return "Level";
      case "credits":
        return "Credits";
      case "instructor":
        return "Instructor";
      case "department":
        return "Department";
      case "type":
        return "Type";
      case "skill":
        return "Skill";
      default:
        return key;
    }
  }

  // Sorting
  if (sortCombinedSelect) {
    sortCombinedSelect.addEventListener("change", applyFiltersAndSort);
  }

  function applyFiltersAndSort() {
    const sortMode = sortCombinedSelect ? sortCombinedSelect.value : "none";
    visibleCourses = allCourses
      .filter((c) => matchesFilters(c, activeFilters))
      .slice();

    if (sortMode !== "none") {
      const [by, dir] = sortMode.split("-");
      visibleCourses.sort((a, b) => compareCourses(a, b, by, dir));
    }

    renderList();
    // Keep selected details if still present; else clear
    if (!visibleCourses.some((c) => c.id === selectedCourseId)) {
      selectedCourseId = null;
    }
    renderDetails();
    if (visibleCourses.length === 0) {
      showMessage("No courses found for current filters.", "info");
    } else {
      // keep any previous message if it was informational about skipped entries
      // otherwise clear
      if (!messageArea.textContent || messageArea.classList.contains("error")) {
        clearMessage();
      }
    }
  }

  function matchesFilters(course, filters) {
    for (const [key, value] of Object.entries(filters)) {
      const field = course[key];
      if (field == null || String(field).toLowerCase() !== value.toLowerCase()) {
        return false;
      }
    }
    return true;
  }

  function compareCourses(a, b, sortBy, sortDir) {
    let cmp = 0;
    if (sortBy === "title") {
      const at = a.title || "";
      const bt = b.title || "";
      cmp = at.localeCompare(bt, undefined, { sensitivity: "base" });
    } else if (sortBy === "id") {
      const aid = a.id != null ? String(a.id) : "";
      const bid = b.id != null ? String(b.id) : "";
      // Try numeric compare when both look numeric; else string
      const an = Number(aid);
      const bn = Number(bid);
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        cmp = an - bn;
      } else {
        cmp = aid.localeCompare(bid, undefined, { sensitivity: "base" });
      }
    } else if (sortBy === "semester") {
      const ar = window.Course.semesterRank(a.postedTime);
      const br = window.Course.semesterRank(b.postedTime);
      if (ar == null && br == null) cmp = 0;
      else if (ar == null) cmp = 1; // unknown last
      else if (br == null) cmp = -1;
      else cmp = ar - br;
    }
    return sortDir === "desc" ? -cmp : cmp;
  }

  // Rendering
  function renderList() {
    courseList.innerHTML = "";
    for (const c of visibleCourses) {
      const row = document.createElement("button");
      row.className = "course-row";
      row.setAttribute("role", "listitem");
      row.setAttribute("data-id", String(c.id));
      row.type = "button";
      row.textContent = c.getSummary();
      if (c.id === selectedCourseId) {
        row.classList.add("selected");
      }
      row.addEventListener("click", () => {
        selectedCourseId = c.id;
        renderList();
        renderDetails();
      });
      courseList.appendChild(row);
    }
  }

  function renderDetails() {
    courseDetails.innerHTML = "";
    const course =
      selectedCourseId != null
        ? visibleCourses.find((c) => c.id === selectedCourseId) ||
          allCourses.find((c) => c.id === selectedCourseId)
        : null;
    if (!course) {
      const ph = document.createElement("div");
      ph.className = "placeholder";
      ph.textContent = "Select a course to see details.";
      courseDetails.appendChild(ph);
      return;
    }
    const header = document.createElement("h2");
    header.textContent = course.title || "Course";
    const grid = document.createElement("div");
    grid.className = "details-grid";

    const rows = [
      ["ID", course.id],
      ["Department", course.department],
      ["Instructor", course.instructor],
      ["Credits", course.credits],
      ["Level", course.level],
      ["Type", course.type],
      ["Skill", course.skill],
      ["Semester", course.postedTime],
      ["Description", course.detail]
    ];
    for (const [label, value] of rows) {
      grid.appendChild(detailRow(label, value));
    }
    courseDetails.appendChild(header);
    courseDetails.appendChild(grid);
  }

  function detailRow(label, value) {
    const row = document.createElement("div");
    row.className = "detail-row";
    const k = document.createElement("div");
    k.className = "detail-key";
    k.textContent = label;
    const v = document.createElement("div");
    v.className = "detail-value";
    v.textContent =
      value == null || value === "" ? "—" : String(value);
    row.appendChild(k);
    row.appendChild(v);
    return row;
  }
})();

