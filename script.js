const STORAGE_KEY = "swynex_tasks_v1";

const state = {
  tasks: loadTasks(),
  filter: "all",
  search: "",
  priority: "all",
  editingId: null
};

const $ = (selector) => document.querySelector(selector);

const taskList = $("#taskList");
const emptyState = $("#emptyState");
const modalBackdrop = $("#modalBackdrop");
const taskForm = $("#taskForm");
const titleInput = $("#title");
const descriptionInput = $("#description");
const priorityInput = $("#priority");
const dueDateInput = $("#dueDate");
const taskIdInput = $("#taskId");
const toast = $("#toast");

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function escapeHTML(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function formatDate(dateString) {
  if (!dateString) return "No due date";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric"
  });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function filteredTasks() {
  return state.tasks
    .filter(task => {
      if (state.filter === "active") return !task.completed;
      if (state.filter === "completed") return task.completed;
      return true;
    })
    .filter(task => state.priority === "all" || task.priority === state.priority)
    .filter(task => {
      const query = state.search.toLowerCase();
      return `${task.title} ${task.description}`.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
}

function render() {
  const tasks = filteredTasks();

  $("#totalCount").textContent = state.tasks.length;
  $("#activeCount").textContent = state.tasks.filter(t => !t.completed).length;
  $("#completedCount").textContent = state.tasks.filter(t => t.completed).length;

  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  $("#progressCount").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;
  $("#progressText").textContent = `You have ${completed} completed task${completed === 1 ? "" : "s"}.`;

  taskList.innerHTML = tasks.map(taskTemplate).join("");
  emptyState.classList.toggle("hidden", tasks.length !== 0);
}

function taskTemplate(task) {
  return `
    <article class="task-card ${task.completed ? "completed" : ""}">
      <button class="task-check" type="button" data-action="toggle" data-id="${task.id}" aria-label="Mark task complete">
        ${task.completed ? "✓" : ""}
      </button>
      <div class="task-main">
        <h3>${escapeHTML(task.title)}</h3>
        <p>${escapeHTML(task.description || "No description provided.")}</p>
        <div class="task-meta">
          <span class="badge ${task.priority}">${task.priority}</span>
          <span class="due">Due ${formatDate(task.dueDate)}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" type="button" data-action="edit" data-id="${task.id}" aria-label="Edit task">✎</button>
        <button class="icon-btn" type="button" data-action="delete" data-id="${task.id}" aria-label="Delete task">⌫</button>
      </div>
    </article>
  `;
}

function openModal(task = null) {
  state.editingId = task?.id || null;
  $("#modalTitle").textContent = task ? "Edit Task" : "Add New Task";
  taskIdInput.value = task?.id || "";
  titleInput.value = task?.title || "";
  descriptionInput.value = task?.description || "";
  priorityInput.value = task?.priority || "medium";
  dueDateInput.value = task?.dueDate || todayISO();
  clearErrors();
  modalBackdrop.classList.remove("hidden");
  setTimeout(() => titleInput.focus(), 0);
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
  state.editingId = null;
  taskForm.reset();
  clearErrors();
}

function clearErrors() {
  $("#titleError").textContent = "";
  $("#dateError").textContent = "";
  titleInput.removeAttribute("aria-invalid");
  dueDateInput.removeAttribute("aria-invalid");
}

function validateForm() {
  clearErrors();
  let valid = true;
  const title = titleInput.value.trim();

  if (title.length < 3) {
    $("#titleError").textContent = "Task title must contain at least 3 characters.";
    titleInput.setAttribute("aria-invalid", "true");
    valid = false;
  }

  if (!dueDateInput.value) {
    $("#dateError").textContent = "Please select a due date.";
    dueDateInput.setAttribute("aria-invalid", "true");
    valid = false;
  } else if (dueDateInput.value < todayISO()) {
    $("#dateError").textContent = "Due date cannot be in the past.";
    dueDateInput.setAttribute("aria-invalid", "true");
    valid = false;
  }

  return valid;
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateForm()) return;

  const data = {
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    priority: priorityInput.value,
    dueDate: dueDateInput.value
  };

  if (state.editingId) {
    const index = state.tasks.findIndex(t => t.id === state.editingId);
    if (index !== -1) state.tasks[index] = { ...state.tasks[index], ...data };
    showToast("Task updated successfully.");
  } else {
    state.tasks.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      ...data,
      completed: false,
      createdAt: new Date().toISOString()
    });
    showToast("Task added successfully.");
  }

  saveTasks();
  render();
  closeModal();
});

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  if (button.dataset.action === "toggle") {
    task.completed = !task.completed;
    saveTasks();
    render();
    showToast(task.completed ? "Task completed!" : "Task moved back to active.");
  }

  if (button.dataset.action === "edit") openModal(task);

  if (button.dataset.action === "delete") {
    if (confirm(`Delete "${task.title}"?`)) {
      state.tasks = state.tasks.filter(t => t.id !== id);
      saveTasks();
      render();
      showToast("Task deleted.");
    }
  }
});

$("#openModalBtn").addEventListener("click", () => openModal());
$("#closeModalBtn").addEventListener("click", closeModal);
$("#cancelBtn").addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalBackdrop.classList.contains("hidden")) closeModal();
});

document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    render();
  });
});

$("#searchInput").addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

$("#priorityFilter").addEventListener("change", (event) => {
  state.priority = event.target.value;
  render();
});

$("#profileButton").addEventListener("click", () => {
  showToast("Welcome to your SWYNEX workspace.");
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

render();
