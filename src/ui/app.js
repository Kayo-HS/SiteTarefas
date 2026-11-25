/**
 * Task Scheduler - Main Application Entry Point
 * Orquestra todos os serviços e gerencia o estado da UI
 */
import { TaskService } from '../services/TaskService.js';
import { StorageRepository } from '../services/StorageRepository.js';
import { CalendarEngine } from '../services/CalendarEngine.js';
import { ViewRouter } from '../services/RouterService.js';
import { Task, TaskFilter } from '../domain/Task.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

class AppState {
    constructor() {
        this.currentView = 'create';
        this.calendarMode = 'month';
        this.calendarDate = new Date();
        this.pendingFilter = new TaskFilter({ status: 'pending' });
        this.completedFilter = new TaskFilter({ status: 'completed' });
        this.selectedTaskId = null;
        this.tasks = [];
    }
}

const state = new AppState();

// ============================================================================
// SERVICE INSTANCES (Dependency Injection)
// ============================================================================

const storage = new StorageRepository('task-scheduler-tasks');
const taskService = new TaskService(storage);
const calendarEngine = new CalendarEngine();
const viewRouter = new ViewRouter({ defaultView: 'create' });

// ============================================================================
// DOM ELEMENTS CACHE
// ============================================================================

const elements = {
    // Navigation
    navButtons: document.querySelectorAll('.nav-btn[data-view]'),
    pendingCount: document.getElementById('pending-count'),
    completedCount: document.getElementById('completed-count'),

    // Views
    views: document.querySelectorAll('.view[data-view-id]'),

    // Create Task Form
    taskForm: document.getElementById('task-form'),
    taskTitle: document.getElementById('task-title'),
    taskDescription: document.getElementById('task-description'),
    taskDate: document.getElementById('task-date'),
    taskTime: document.getElementById('task-time'),
    taskCategory: document.getElementById('task-category'),
    titleError: document.getElementById('title-error'),
    dateError: document.getElementById('date-error'),

    // Pending Tasks
    pendingTasks: document.getElementById('pending-tasks'),
    pendingEmpty: document.getElementById('pending-empty'),
    pendingFilter: document.getElementById('pending-filter'),
    clearCompleted: document.getElementById('clear-completed'),

    // Completed Tasks
    completedTasks: document.getElementById('completed-tasks'),
    completedEmpty: document.getElementById('completed-empty'),
    completedFilter: document.getElementById('completed-filter'),

    // Calendar
    calendarModeButtons: document.querySelectorAll('.mode-btn[data-mode]'),
    calPrev: document.getElementById('cal-prev'),
    calNext: document.getElementById('cal-next'),
    calToday: document.getElementById('cal-today'),
    calCurrentPeriod: document.getElementById('cal-current-period'),
    yearGrid: document.getElementById('year-grid'),
    monthGrid: document.getElementById('month-grid'),
    monthHeader: document.getElementById('month-header'),
    weekGrid: document.getElementById('week-grid'),
    weekHeader: document.getElementById('week-header'),
    dayTimeline: document.getElementById('day-timeline'),
    dayHeader: document.getElementById('day-header'),

    // Modal
    taskModal: document.getElementById('task-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalCloseButtons: document.querySelectorAll('.modal-close, .modal-close-btn'),
    modalDelete: document.getElementById('modal-delete'),
    modalToggle: document.getElementById('modal-toggle'),
    modalToggleText: document.getElementById('modal-toggle-text'),

    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    elements.taskDate.value = today;
    elements.taskDate.min = today;

    // Initialize router
    viewRouter.init(document.getElementById('app'));

    // Register views with router
    elements.views.forEach(view => {
        viewRouter.registerView(view.dataset.viewId, view);
    });

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    await refreshAllData();

    // Setup view change listener
    viewRouter.onViewChange(handleViewChange);

    console.log('Task Scheduler initialized');
}

function setupEventListeners() {
    // Navigation
    elements.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            viewRouter.navigate(view);
        });
    });

    // Create Task Form
    elements.taskForm.addEventListener('submit', handleCreateTask);
    elements.taskForm.addEventListener('reset', () => {
        setTimeout(() => {
            elements.taskDate.value = new Date().toISOString().split('T')[0];
            clearFormErrors();
        }, 0);
    });

    // Form validation
    elements.taskTitle.addEventListener('input', () => clearFieldError('title'));
    elements.taskDate.addEventListener('input', () => clearFieldError('date'));

    // Pending Tasks
    elements.pendingFilter.addEventListener('change', () => refreshPendingTasks());
    elements.clearCompleted.addEventListener('click', handleClearCompleted);

    // Completed Tasks
    elements.completedFilter.addEventListener('change', () => refreshCompletedTasks());

    // Calendar
    elements.calendarModeButtons.forEach(btn => {
        btn.addEventListener('click', () => switchCalendarMode(btn.dataset.mode));
    });
    elements.calPrev.addEventListener('click', () => navigateCalendar(-1));
    elements.calNext.addEventListener('click', () => navigateCalendar(1));
    elements.calToday.addEventListener('click', () => goToToday());

    // Modal
    elements.modalCloseButtons.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    elements.modalDelete.addEventListener('click', handleDeleteTask);
    elements.modalToggle.addEventListener('click', handleToggleTask);
    elements.taskModal.addEventListener('click', (e) => {
        if (e.target === elements.taskModal) closeModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ============================================================================
// DATA LOADING & REFRESH
// ============================================================================

async function refreshAllData() {
    await Promise.all([
        refreshCounts(),
        refreshPendingTasks(),
        refreshCompletedTasks(),
        refreshCalendar()
    ]);
}

async function refreshCounts() {
    const counts = await taskService.getCounts();
    elements.pendingCount.textContent = counts.pending;
    elements.pendingCount.classList.toggle('badge-zero', counts.pending === 0);
    elements.completedCount.textContent = counts.completed;
    elements.completedCount.classList.toggle('badge-zero', counts.completed === 0);
}

async function refreshPendingTasks() {
    const filter = new TaskFilter({
        status: 'pending',
        ...getFilterFromSelect(elements.pendingFilter)
    });
    const tasks = await taskService.listTasks(filter);
    renderTaskList(elements.pendingTasks, tasks, elements.pendingEmpty);
}

async function refreshCompletedTasks() {
    const filter = new TaskFilter({
        status: 'completed',
        ...getFilterFromSelect(elements.completedFilter)
    });
    const tasks = await taskService.listTasks(filter);
    renderTaskList(elements.completedTasks, tasks, elements.completedEmpty);
}

function getFilterFromSelect(select) {
    const value = select.value;
    switch (value) {
        case 'today':
            return { dateRange: { start: todayStr(), end: todayStr() } };
        case 'week':
            return { dateRange: getWeekRange() };
        case 'overdue':
            return { status: 'pending' }; // Handled in render
        case 'high':
            return { priority: 'high' };
        default:
            return {};
    }
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function getWeekRange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

async function refreshCalendar() {
    state.tasks = await taskService.listTasks();

    switch (state.calendarMode) {
        case 'year':
            renderYearView();
            break;
        case 'month':
            renderMonthView();
            break;
        case 'week':
            renderWeekView();
            break;
        case 'day':
            renderDayView();
            break;
    }
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderTaskList(container, tasks, emptyElement) {
    container.innerHTML = '';

    if (tasks.length === 0) {
        container.hidden = true;
        emptyElement.hidden = false;
        return;
    }

    container.hidden = false;
    emptyElement.hidden = true;

    // Apply additional filters for pending view
    let filteredTasks = tasks;
    if (elements.pendingFilter.value === 'overdue') {
        filteredTasks = tasks.filter(t => t.isOverdue());
    }

    filteredTasks.forEach(task => {
        container.appendChild(createTaskCard(task));
    });
}

function createTaskCard(task) {
    const card = document.createElement('article');
    card.className = `task-card ${task.completed ? 'completed' : ''} priority-${task.priority}`;
    card.dataset.taskId = task.id;
    card.innerHTML = `
        <button class="task-checkbox ${task.completed ? 'checked' : ''}" aria-label="${task.completed ? 'Reabrir' : 'Concluir'} tarefa" aria-pressed="${task.completed}">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        </button>
        <div class="task-content">
            <div class="task-header">
                <h3 class="task-title">${escapeHtml(task.title)}</h3>
                <div class="task-meta">
                    ${task.time ? `<span class="task-time">${CalendarEngine.formatTime(task.time)}</span>` : ''}
                    <span class="task-category ${task.category}">${task.category}</span>
                    <span class="task-priority ${task.priority}">${task.priority}</span>
                </div>
            </div>
            ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
            <div class="task-actions">
                <button class="task-action-btn edit" aria-label="Editar tarefa">Editar</button>
                <button class="task-action-btn delete" aria-label="Excluir tarefa">Excluir</button>
            </div>
        </div>
    `;

    // Event listeners
    const checkbox = card.querySelector('.task-checkbox');
    checkbox.addEventListener('click', () => toggleTaskComplete(task.id));

    card.querySelector('.edit').addEventListener('click', () => openTaskModal(task));
    card.querySelector('.delete').addEventListener('click', () => confirmDeleteTask(task));

    return card;
}

function renderYearView() {
    const year = state.calendarDate.getFullYear();
    const viewData = calendarEngine.generateYearView(year, state.tasks);

    elements.calCurrentPeriod.textContent = year;
    elements.yearGrid.innerHTML = '';

    viewData.months.forEach(monthData => {
        const monthEl = document.createElement('div');
        monthEl.className = 'year-month';
        monthEl.innerHTML = `
            <div class="year-month-header">
                <span class="year-month-name">${monthData.monthName}</span>
                <span class="year-month-count">${monthData.taskCount} tarefas</span>
            </div>
            <div class="year-month-grid">
                <div class="year-day-header">D</div>
                <div class="year-day-header">S</div>
                <div class="year-day-header">T</div>
                <div class="year-day-header">Q</div>
                <div class="year-day-header">Q</div>
                <div class="year-day-header">S</div>
                <div class="year-day-header">S</div>
                ${monthData.weeks.flatMap(week => week.map(day => `
                    <div class="year-day-cell ${day.isOtherMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${day.isPast ? 'past' : ''} ${day.hasTasks ? 'has-tasks' : ''} ${day.hasHighPriority ? 'high-priority' : ''} ${day.completedCount > 0 && day.completedCount === day.taskCount ? 'completed' : ''}"
                         data-date="${day.date}" title="${day.taskCount} tarefa(s)">
                        ${day.day}
                    </div>
                `).join('')).join('')}
            </div>
        `;

        // Click on day to switch to month view
        monthEl.querySelectorAll('.year-day-cell:not(.other-month)').forEach(cell => {
            cell.addEventListener('click', () => {
                const date = new Date(cell.dataset.date + 'T00:00:00');
                state.calendarDate = date;
                switchCalendarMode('month');
            });
        });

        elements.yearGrid.appendChild(monthEl);
    });
}

function renderMonthView() {
    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth();
    const viewData = calendarEngine.generateMonthView(year, month, state.tasks);

    elements.calCurrentPeriod.textContent = viewData.monthName;

    // Render day headers
    elements.monthHeader.innerHTML = '';
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(day => {
        const el = document.createElement('div');
        el.className = 'month-day-name';
        el.textContent = day;
        elements.monthHeader.appendChild(el);
    });

    // Render days
    elements.monthGrid.innerHTML = '';
    viewData.weeks.forEach(week => {
        week.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = `month-day ${day.isOtherMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''}`;
            dayEl.dataset.date = day.date;

            const tasksHtml = day.tasks.slice(0, 3).map(task => `
                <div class="month-day-task ${task.priority} ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                    ${task.time ? `<span class="task-time">${CalendarEngine.formatTime(task.time)}</span>` : ''}
                    ${escapeHtml(task.title)}
                </div>
            `).join('');

            const moreCount = day.tasks.length - 3;
            const moreHtml = moreCount > 0 ? `<div class="month-day-more" data-date="${day.date}">+${moreCount} mais</div>` : '';

            dayEl.innerHTML = `
                <div class="month-day-number">${day.day}</div>
                <div class="month-day-tasks">
                    ${tasksHtml}
                    ${moreHtml}
                </div>
            `;

            // Click handlers
            dayEl.querySelectorAll('.month-day-task').forEach(taskEl => {
                taskEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const task = state.tasks.find(t => t.id === taskEl.dataset.taskId);
                    if (task) openTaskModal(task);
                });
            });

            if (moreCount > 0) {
                dayEl.querySelector('.month-day-more').addEventListener('click', (e) => {
                    e.stopPropagation();
                    state.calendarDate = new Date(day.date + 'T00:00:00');
                    switchCalendarMode('day');
                });
            }

            // Click day to go to day view
            if (!day.isOtherMonth) {
                dayEl.addEventListener('click', () => {
                    state.calendarDate = new Date(day.date + 'T00:00:00');
                    switchCalendarMode('day');
                });
            }

            elements.monthGrid.appendChild(dayEl);
        });
    });
}

function renderWeekView() {
    const weekStart = calendarEngine.getWeekStart(state.calendarDate);
    const viewData = calendarEngine.generateWeekView(weekStart, state.tasks);

    elements.calCurrentPeriod.textContent = viewData.weekLabel;

    // Render header
    elements.weekHeader.innerHTML = '';
    // Hour label corner
    const corner = document.createElement('div');
    corner.className = 'week-hour-label';
    elements.weekHeader.appendChild(corner);

    viewData.days.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = `week-day-header ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''}`;
        dayEl.innerHTML = `
            <span class="week-day-name">${day.dayName}</span>
            <span class="week-day-number">${day.dayNumber}</span>
        `;
        elements.weekHeader.appendChild(dayEl);
    });

    // Render grid
    elements.weekGrid.innerHTML = '';
    for (let hour = 0; hour < 24; hour++) {
        // Hour label
        const hourLabel = document.createElement('div');
        hourLabel.className = 'week-hour';
        hourLabel.textContent = `${String(hour).padStart(2, '0')}:00`;
        elements.weekGrid.appendChild(hourLabel);

        // Day columns
        viewData.days.forEach((day, dayIndex) => {
            const col = document.createElement('div');
            col.className = `week-day-column ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''}`;
            col.dataset.date = day.date;

            // Events for this hour
            const hourEvents = day.tasks.filter(task => {
                if (!task.time) return false;
                const taskHour = parseInt(task.time.split(':')[0], 10);
                return taskHour === hour;
            });

            hourEvents.forEach(task => {
                const eventEl = document.createElement('div');
                eventEl.className = `week-event ${task.category} ${task.completed ? 'completed' : ''}`;
                eventEl.dataset.taskId = task.id;
                eventEl.style.top = `${(parseInt(task.time.split(':')[1], 10) / 60) * 100}%`;
                eventEl.style.height = 'calc(100% / 60 * 30)'; // 30 min default
                eventEl.innerHTML = `
                    <span class="week-event-time">${CalendarEngine.formatTime(task.time)}</span>
                    <span class="week-event-title">${escapeHtml(task.title)}</span>
                `;
                eventEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const t = state.tasks.find(t => t.id === task.id);
                    if (t) openTaskModal(t);
                });
                col.appendChild(eventEl);
            });

            // All-day tasks (render at hour 0)
            if (hour === 0) {
                const allDayTasks = day.tasks.filter(t => !t.time);
                allDayTasks.forEach(task => {
                    const eventEl = document.createElement('div');
                    eventEl.className = `week-event ${task.category} ${task.completed ? 'completed' : ''} all-day`;
                    eventEl.dataset.taskId = task.id;
                    eventEl.style.top = '0';
                    eventEl.style.height = 'auto';
                    eventEl.style.padding = '4px 8px';
                    eventEl.innerHTML = `
                        <span class="week-event-title">${escapeHtml(task.title)}</span>
                    `;
                    eventEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const t = state.tasks.find(t => t.id === task.id);
                        if (t) openTaskModal(t);
                    });
                    col.appendChild(eventEl);
                });
            }

            elements.weekGrid.appendChild(col);
        });
    }
}

function renderDayView() {
    const viewData = calendarEngine.generateDayView(state.calendarDate, state.tasks);

    elements.calCurrentPeriod.textContent = `${viewData.dayName}, ${viewData.dayNumber} de ${viewData.monthName} de ${viewData.year}`;

    // Day header
    elements.dayHeader.innerHTML = `
        <h3>${viewData.dayName}, ${viewData.dayNumber} de ${viewData.monthName} de ${viewData.year}</h3>
    `;

    // All-day tasks
    let allDayHtml = '';
    if (viewData.allDayTasks.length > 0) {
        allDayHtml = `
            <div class="day-all-day">
                <div class="day-all-day-label">Dia todo</div>
                <div class="day-all-day-tasks">
                    ${viewData.allDayTasks.map(task => `
                        <div class="day-all-day-task ${task.category} ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                            ${escapeHtml(task.title)}
                            <span class="task-priority ${task.priority}">${task.priority}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Timeline
    const timelineHtml = viewData.hours.map(hour => `
        <div class="day-hour ${hour.isCurrentHour ? 'current' : ''} ${hour.isPast ? 'past' : ''}">${hour.label}</div>
        <div class="day-slot ${hour.isCurrentHour ? 'current' : ''} ${hour.isPast ? 'past' : ''}" data-hour="${hour.hour}">
            ${hour.tasks.map(task => `
                <div class="day-event ${task.category} ${task.completed ? 'completed' : ''}"
                     data-task-id="${task.id}"
                     style="top: ${getMinuteOffset(task.time)}%; height: ${getEventHeight(task.time)}%;">
                    <span class="day-event-time">${CalendarEngine.formatTime(task.time)}</span>
                    <span class="day-event-title">${escapeHtml(task.title)}</span>
                    <span class="day-event-category">${task.category}</span>
                </div>
            `).join('')}
        </div>
    `).join('');

    elements.dayTimeline.innerHTML = allDayHtml + timelineHtml;

    // Event listeners
    elements.dayTimeline.querySelectorAll('.day-event, .day-all-day-task').forEach(el => {
        el.addEventListener('click', () => {
            const task = state.tasks.find(t => t.id === el.dataset.taskId);
            if (task) openTaskModal(task);
        });
    });
}

function getMinuteOffset(timeStr) {
    if (!timeStr) return 0;
    const [, minutes] = timeStr.split(':').map(Number);
    return (minutes / 60) * 100;
}

function getEventHeight(timeStr) {
    // Default 30 min = 50% of hour slot
    return 50;
}

// ============================================================================
// CALENDAR NAVIGATION
// ============================================================================

function switchCalendarMode(mode) {
    state.calendarMode = mode;

    // Update buttons
    elements.calendarModeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
        btn.setAttribute('aria-selected', btn.dataset.mode === mode);
    });

    // Show/hide views
    document.querySelectorAll('.calendar-view').forEach(view => {
        view.classList.toggle('active', view.id === `cal-${mode}`);
        view.hidden = view.id !== `cal-${mode}`;
    });

    refreshCalendar();
}

function navigateCalendar(direction) {
    switch (state.calendarMode) {
        case 'year':
            state.calendarDate.setFullYear(state.calendarDate.getFullYear() + direction);
            break;
        case 'month':
            state.calendarDate.setMonth(state.calendarDate.getMonth() + direction);
            break;
        case 'week':
            if (direction > 0) {
                state.calendarDate = calendarEngine.getNextWeek(calendarEngine.getWeekStart(state.calendarDate));
            } else {
                state.calendarDate = calendarEngine.getPrevWeek(calendarEngine.getWeekStart(state.calendarDate));
            }
            break;
        case 'day':
            state.calendarDate.setDate(state.calendarDate.getDate() + direction);
            break;
    }
    refreshCalendar();
}

function goToToday() {
    state.calendarDate = new Date();
    refreshCalendar();
}

// ============================================================================
// TASK CRUD OPERATIONS
// ============================================================================

async function handleCreateTask(e) {
    e.preventDefault();

    // Validation
    if (!validateForm()) return;

    const formData = new FormData(elements.taskForm);
    const taskData = {
        title: formData.get('title'),
        description: formData.get('description'),
        date: formData.get('date'),
        time: formData.get('time') || '',
        category: formData.get('category'),
        priority: formData.get('priority')
    };

    try {
        await taskService.createTask(taskData);
        showToast('Tarefa criada com sucesso!', 'success');
        elements.taskForm.reset();
        elements.taskDate.value = new Date().toISOString().split('T')[0];
        await refreshAllData();
    } catch (error) {
        showToast(`Erro ao criar tarefa: ${error.message}`, 'error');
    }
}

function validateForm() {
    let valid = true;

    if (!elements.taskTitle.value.trim()) {
        showFieldError('title', 'Título é obrigatório');
        valid = false;
    }

    if (!elements.taskDate.value) {
        showFieldError('date', 'Data é obrigatória');
        valid = false;
    } else {
        const selectedDate = new Date(elements.taskDate.value + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
            showFieldError('date', 'Não é possível agendar para datas passadas');
            valid = false;
        }
    }

    return valid;
}

function showFieldError(field, message) {
    const errorEl = document.getElementById(`${field}-error`);
    const inputEl = document.getElementById(`task-${field}`);
    if (errorEl) errorEl.textContent = message;
    if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
}

function clearFieldError(field) {
    const errorEl = document.getElementById(`${field}-error`);
    const inputEl = document.getElementById(`task-${field}`);
    if (errorEl) errorEl.textContent = '';
    if (inputEl) inputEl.removeAttribute('aria-invalid');
}

function clearFormErrors() {
    clearFieldError('title');
    clearFieldError('date');
}

async function toggleTaskComplete(taskId) {
    try {
        await taskService.toggleComplete(taskId);
        await refreshAllData();
    } catch (error) {
        showToast(`Erro ao atualizar tarefa: ${error.message}`, 'error');
    }
}

async function handleClearCompleted() {
    if (!confirm('Tem certeza que deseja remover todas as tarefas concluídas?')) return;

    try {
        const count = await taskService.clearCompleted();
        showToast(`${count} tarefa(s) concluída(s) removida(s)`, 'success');
        await refreshAllData();
    } catch (error) {
        showToast(`Erro ao limpar tarefas: ${error.message}`, 'error');
    }
}

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

function openTaskModal(task) {
    state.selectedTaskId = task.id;

    elements.modalTitle.textContent = task.completed ? 'Tarefa Concluída' : 'Detalhes da Tarefa';
    elements.modalToggleText.textContent = task.completed ? 'Reabrir' : 'Concluir';
    elements.modalDelete.style.display = 'inline-flex';

    elements.modalBody.innerHTML = `
        <div class="modal-task-detail">
            <div class="modal-task-row">
                <span class="modal-task-label">Título</span>
                <span class="modal-task-value">${escapeHtml(task.title)}</span>
            </div>
            ${task.description ? `
            <div class="modal-task-row">
                <span class="modal-task-label">Descrição</span>
                <span class="modal-task-value modal-task-description">${escapeHtml(task.description)}</span>
            </div>
            ` : ''}
            <div class="modal-task-row">
                <span class="modal-task-label">Data</span>
                <span class="modal-task-value">${CalendarEngine.formatDate(task.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            ${task.time ? `
            <div class="modal-task-row">
                <span class="modal-task-label">Horário</span>
                <span class="modal-task-value">${CalendarEngine.formatTime(task.time)}</span>
            </div>
            ` : ''}
            <div class="modal-task-row">
                <span class="modal-task-label">Categoria</span>
                <span class="modal-task-value"><span class="task-category ${task.category}">${task.category}</span></span>
            </div>
            <div class="modal-task-row">
                <span class="modal-task-label">Prioridade</span>
                <span class="modal-task-value"><span class="task-priority ${task.priority}">${task.priority}</span></span>
            </div>
            <div class="modal-task-row">
                <span class="modal-task-label">Status</span>
                <span class="modal-task-value">${task.completed ? 'Concluída' : 'Pendente'}</span>
            </div>
            <div class="modal-task-row">
                <span class="modal-task-label">Criada em</span>
                <span class="modal-task-value">${new Date(task.createdAt).toLocaleString('pt-BR')}</span>
            </div>
            ${task.updatedAt !== task.createdAt ? `
            <div class="modal-task-row">
                <span class="modal-task-label">Atualizada em</span>
                <span class="modal-task-value">${new Date(task.updatedAt).toLocaleString('pt-BR')}</span>
            </div>
            ` : ''}
            ${task.completedAt ? `
            <div class="modal-task-row">
                <span class="modal-task-label">Concluída em</span>
                <span class="modal-task-value">${new Date(task.completedAt).toLocaleString('pt-BR')}</span>
            </div>
            ` : ''}
        </div>
    `;

    elements.taskModal.showModal();
    // Focus first focusable element for accessibility
    elements.modalCloseButtons[0].focus();
}

function closeModal() {
    elements.taskModal.close();
    state.selectedTaskId = null;
}

async function handleToggleTask() {
    if (!state.selectedTaskId) return;

    try {
        await taskService.toggleComplete(state.selectedTaskId);
        showToast('Status da tarefa atualizado', 'success');
        closeModal();
        await refreshAllData();
    } catch (error) {
        showToast(`Erro: ${error.message}`, 'error');
    }
}

function confirmDeleteTask(task) {
    if (confirm(`Excluir "${task.title}"? Esta ação não pode ser desfeita.`)) {
        deleteTask(task.id);
    }
}

async function handleDeleteTask() {
    if (!state.selectedTaskId) return;

    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    await deleteTask(state.selectedTaskId);
    closeModal();
}

async function deleteTask(taskId) {
    try {
        await taskService.deleteTask(taskId);
        showToast('Tarefa excluída', 'success');
        await refreshAllData();
    } catch (error) {
        showToast(`Erro ao excluir: ${error.message}`, 'error');
    }
}

// ============================================================================
// VIEW CHANGE HANDLER
// ============================================================================

function handleViewChange(viewId) {
    state.currentView = viewId;

    // Update nav buttons
    elements.navButtons.forEach(btn => {
        const isActive = btn.dataset.view === viewId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    // Refresh data for specific views
    switch (viewId) {
        case 'pending':
            refreshPendingTasks();
            break;
        case 'completed':
            refreshCompletedTasks();
            break;
        case 'calendar':
            refreshCalendar();
            break;
    }
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + N: Nova tarefa
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        viewRouter.navigate('create');
        setTimeout(() => elements.taskTitle.focus(), 100);
    }

    // Escape: Fechar modal
    if (e.key === 'Escape' && elements.taskModal.open) {
        closeModal();
    }

    // Number keys 1-4 para navegação rápida
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
        const views = ['create', 'pending', 'completed', 'calendar'];
        const index = parseInt(e.key, 10) - 1;
        if (index >= 0 && index < views.length) {
            viewRouter.navigate(views[index]);
        }
    }
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const icons = {
        success: '<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
        ${icons[type] || icons.info}
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" aria-label="Fechar">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));

    elements.toastContainer.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => removeToast(toast), 5000);
}

function removeToast(toast) {
    if (!toast.parentElement) return;
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// START APPLICATION
// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging (optional)
window.__TASK_SCHEDULER__ = {
    taskService,
    calendarEngine,
    state,
    elements
};