import { Task } from '../domain/Task.js';

/**
 * CalendarEngine - Motor de cálculos de calendário
 * Responsável por gerar dados para as 4 visualizações: Anual, Mensal, Semanal, Diária
 * Trata anos bissextos, viradas de mês/semana, fusos horários locais
 */
export class CalendarEngine {
    constructor() {
        this._today = new Date();
        this._today.setHours(0, 0, 0, 0);
    }

    /**
     * Define a data de referência (útil para testes)
     * @param {Date} date
     */
    setReferenceDate(date) {
        this._today = new Date(date);
        this._today.setHours(0, 0, 0, 0);
    }

    /**
     * Obtém data de hoje
     * @returns {Date}
     */
    getToday() {
        return new Date(this._today);
    }

    // ==================== VISÃO ANUAL ====================

    /**
     * Gera dados para visualização anual
     * @param {number} year
     * @param {Task[]} tasks
     * @returns {Object}
     */
    generateYearView(year, tasks) {
        const months = [];
        const tasksByMonth = this._groupTasksByMonth(tasks, year);

        for (let month = 0; month < 12; month++) {
            const monthTasks = tasksByMonth[month] || [];
            const monthData = this._generateMonthData(year, month, monthTasks);
            months.push(monthData);
        }

        return {
            year,
            months,
            isCurrentYear: year === this._today.getFullYear(),
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.completed).length
        };
    }

    /**
     * Gera dados de um mês para a visão anual
     * @private
     */
    _generateMonthData(year, month, tasks) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay(); // 0 = Domingo

        const weeks = [];
        let currentWeek = [];

        // Preenche dias do mês anterior
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            currentWeek.push(this._createDayCell(year, month - 1, day, true));
        }

        // Dias do mês atual
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTasks = tasks.filter(t => t.date === dateStr);
            currentWeek.push(this._createDayCell(year, month, day, false, dayTasks));

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        // Preenche dias do próximo mês
        let nextMonthDay = 1;
        while (currentWeek.length < 7 && currentWeek.length > 0) {
            currentWeek.push(this._createDayCell(year, month + 1, nextMonthDay++, true));
        }
        if (currentWeek.length > 0) {
            weeks.push(currentWeek);
        }

        return {
            month,
            monthName: firstDay.toLocaleDateString('pt-BR', { month: 'long' }),
            weeks,
            taskCount: tasks.length,
            completedCount: tasks.filter(t => t.completed).length
        };
    }

    /**
     * Cria célula de dia para o calendário
     * @private
     */
    _createDayCell(year, month, day, isOtherMonth, tasks = []) {
        const date = new Date(year, month, day);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const isToday = date.getTime() === this._today.getTime();
        const isPast = date < this._today;
        const hasTasks = tasks.length > 0;

        return {
            date: dateStr,
            day,
            isOtherMonth,
            isToday,
            isPast,
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
            tasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                time: t.time,
                category: t.category,
                priority: t.priority,
                completed: t.completed
            })),
            taskCount: tasks.length,
            completedCount: tasks.filter(t => t.completed).length,
            hasHighPriority: tasks.some(t => t.priority === 'high' && !t.completed)
        };
    }

    /**
     * Agrupa tarefas por mês
     * @private
     */
    _groupTasksByMonth(tasks, year) {
        const grouped = {};
        for (const task of tasks) {
            const taskDate = new Date(task.date + 'T00:00:00');
            if (taskDate.getFullYear() === year) {
                const month = taskDate.getMonth();
                if (!grouped[month]) grouped[month] = [];
                grouped[month].push(task);
            }
        }
        return grouped;
    }

    // ==================== VISÃO MENSAL ====================

    /**
     * Gera dados para visualização mensal detalhada
     * @param {number} year
     * @param {number} month (0-11)
     * @param {Task[]} tasks
     * @returns {Object}
     */
    generateMonthView(year, month, tasks) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const monthTasks = tasks.filter(t => {
            const taskDate = new Date(t.date + 'T00:00:00');
            return taskDate.getFullYear() === year && taskDate.getMonth() === month;
        });

        const tasksByDay = this._groupTasksByDay(monthTasks);

        const weeks = [];
        let currentWeek = [];

        // Dias do mês anterior
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const date = new Date(year, month - 1, day);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            currentWeek.push(this._createMonthDayCell(date, dateStr, tasksByDay[dateStr] || [], true));
        }

        // Dias do mês atual
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            currentWeek.push(this._createMonthDayCell(date, dateStr, tasksByDay[dateStr] || [], false));

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        // Dias do próximo mês
        let nextMonthDay = 1;
        while (currentWeek.length < 7 && currentWeek.length > 0) {
            const date = new Date(year, month + 1, nextMonthDay);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(nextMonthDay).padStart(2, '0')}`;
            currentWeek.push(this._createMonthDayCell(date, dateStr, tasksByDay[dateStr] || [], true));
            nextMonthDay++;
        }
        if (currentWeek.length > 0) {
            weeks.push(currentWeek);
        }

        return {
            year,
            month,
            monthName: firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
            weeks,
            today: this._today.toISOString().split('T')[0],
            totalTasks: monthTasks.length,
            completedTasks: monthTasks.filter(t => t.completed).length
        };
    }

    /**
     * Cria célula de dia para visão mensal
     * @private
     */
    _createMonthDayCell(date, dateStr, tasks, isOtherMonth) {
        const isToday = date.getTime() === this._today.getTime();
        const isPast = date < this._today && !isToday;

        return {
            date: dateStr,
            day: date.getDate(),
            isOtherMonth,
            isToday,
            isPast,
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
            tasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                time: t.time,
                category: t.category,
                priority: t.priority,
                completed: t.completed
            })),
            taskCount: tasks.length,
            completedCount: tasks.filter(t => t.completed).length,
            hasHighPriority: tasks.some(t => t.priority === 'high' && !t.completed)
        };
    }

    /**
     * Agrupa tarefas por dia
     * @private
     */
    _groupTasksByDay(tasks) {
        const grouped = {};
        for (const task of tasks) {
            if (!grouped[task.date]) grouped[task.date] = [];
            grouped[task.date].push(task);
        }
        // Ordena tarefas de cada dia
        for (const date in grouped) {
            grouped[date].sort(Task.compare);
        }
        return grouped;
    }

    // ==================== VISÃO SEMANAL ====================

    /**
     * Gera dados para visualização semanal
     * @param {Date} weekStart - Data de início da semana (Domingo)
     * @param {Task[]} tasks
     * @returns {Object}
     */
    generateWeekView(weekStart, tasks) {
        const start = new Date(weekStart);
        start.setHours(0, 0, 0, 0);

        const days = [];
        const tasksByDay = this._groupTasksByDay(tasks);

        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const dayTasks = tasksByDay[dateStr] || [];

            days.push({
                date: dateStr,
                dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
                dayNumber: date.getDate(),
                monthName: date.toLocaleDateString('pt-BR', { month: 'short' }),
                isToday: date.getTime() === this._today.getTime(),
                isWeekend: date.getDay() === 0 || date.getDay() === 6,
                tasks: dayTasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    time: t.time,
                    category: t.category,
                    priority: t.priority,
                    completed: t.completed
                })).sort((a, b) => {
                    if (a.time && b.time) return a.time.localeCompare(b.time);
                    if (a.time) return -1;
                    if (b.time) return 1;
                    return 0;
                })
            });
        }

        const weekEnd = new Date(days[6].date + 'T00:00:00');

        return {
            weekStart: days[0].date,
            weekEnd: days[6].date,
            weekLabel: `${days[0].dayNumber} ${days[0].monthName} - ${days[6].dayNumber} ${days[6].monthName}`,
            days,
            totalTasks: tasks.filter(t => {
                const taskDate = new Date(t.date + 'T00:00:00');
                return taskDate >= start && taskDate <= weekEnd;
            }).length,
            completedTasks: tasks.filter(t => t.completed).length
        };
    }

    /**
     * Obtém início da semana (Domingo) para uma data
     * @param {Date} date
     * @returns {Date}
     */
    getWeekStart(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }

    /**
     * Obtém próxima semana
     * @param {Date} weekStart
     * @returns {Date}
     */
    getNextWeek(weekStart) {
        const next = new Date(weekStart);
        next.setDate(next.getDate() + 7);
        return next;
    }

    /**
     * Obtém semana anterior
     * @param {Date} weekStart
     * @returns {Date}
     */
    getPrevWeek(weekStart) {
        const prev = new Date(weekStart);
        prev.setDate(prev.getDate() - 7);
        return prev;
    }

    // ==================== VISÃO DIÁRIA ====================

    /**
     * Gera dados para visualização diária (timeline)
     * @param {Date} date
     * @param {Task[]} tasks
     * @returns {Object}
     */
    generateDayView(date, tasks) {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const dateStr = targetDate.toISOString().split('T')[0];

        const dayTasks = tasks.filter(t => t.date === dateStr).sort(Task.compare);

        // Cria slots de hora (0-23)
        const hours = [];
        for (let hour = 0; hour < 24; hour++) {
            const hourTasks = dayTasks.filter(t => {
                if (!t.time) return false;
                const taskHour = parseInt(t.time.split(':')[0], 10);
                return taskHour === hour;
            });

            hours.push({
                hour,
                label: `${String(hour).padStart(2, '0')}:00`,
                isCurrentHour: hour === this._today.getHours() && targetDate.getTime() === this._today.getTime(),
                isPast: targetDate < this._today || (targetDate.getTime() === this._today.getTime() && hour < this._today.getHours()),
                tasks: hourTasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    time: t.time,
                    category: t.category,
                    priority: t.priority,
                    completed: t.completed
                }))
            });
        }

        // Tarefas sem horário (all-day)
        const allDayTasks = dayTasks.filter(t => !t.time);

        return {
            date: dateStr,
            dayName: targetDate.toLocaleDateString('pt-BR', { weekday: 'long' }),
            dayNumber: targetDate.getDate(),
            monthName: targetDate.toLocaleDateString('pt-BR', { month: 'long' }),
            year: targetDate.getFullYear(),
            isToday: targetDate.getTime() === this._today.getTime(),
            isWeekend: targetDate.getDay() === 0 || targetDate.getDay() === 6,
            hours,
            allDayTasks: allDayTasks.map(t => ({
                id: t.id,
                title: t.title,
                category: t.category,
                priority: t.priority,
                completed: t.completed
            })),
            totalTasks: dayTasks.length,
            completedTasks: dayTasks.filter(t => t.completed).length
        };
    }

    // ==================== UTILITÁRIOS ====================

    /**
     * Verifica se ano é bissexto
     * @static
     * @param {number} year
     * @returns {boolean}
     */
    static isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    /**
     * Obtém dias no mês
     * @static
     * @param {number} year
     * @param {number} month (0-11)
     * @returns {number}
     */
    static getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    /**
     * Formata data para exibição
     * @static
     * @param {string} dateStr - YYYY-MM-DD
     * @param {Object} options - Opções do Intl.DateTimeFormat
     * @returns {string}
     */
    static formatDate(dateStr, options = {}) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('pt-BR', options);
    }

    /**
     * Formata horário para exibição
     * @static
     * @param {string} timeStr - HH:MM
     * @returns {string}
     */
    static formatTime(timeStr) {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        return `${hours}h${minutes}`;
    }
}