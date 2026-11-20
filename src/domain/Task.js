/**
 * Task Model - Entidade de domínio principal
 * Representa uma tarefa no sistema seguindo princípios de Domain-Driven Design
 */
export class Task {
    /**
     * @param {Object} params
     * @param {string} [params.id] - UUID único (gerado automaticamente se não fornecido)
     * @param {string} params.title - Título da tarefa (obrigatório)
     * @param {string} [params.description=''] - Descrição opcional
     * @param {string} params.date - Data no formato YYYY-MM-DD (obrigatório)
     * @param {string} [params.time=''] - Horário no formato HH:MM (opcional)
     * @param {string} [params.category='personal'] - Categoria: personal, work, study, health, other
     * @param {string} [params.priority='medium'] - Prioridade: low, medium, high
     * @param {boolean} [params.completed=false] - Status de conclusão
     * @param {string} [params.createdAt] - ISO timestamp de criação
     * @param {string} [params.updatedAt] - ISO timestamp de última atualização
     * @param {string} [params.completedAt] - ISO timestamp de conclusão
     */
    constructor({
        id = crypto.randomUUID(),
        title,
        description = '',
        date,
        time = '',
        category = 'personal',
        priority = 'medium',
        completed = false,
        createdAt = new Date().toISOString(),
        updatedAt = new Date().toISOString(),
        completedAt = null
    }) {
        // Validações de domínio
        if (!title || !title.trim()) {
            throw new Error('Task title is required');
        }
        if (!date) {
            throw new Error('Task date is required');
        }
        if (!this._isValidDateFormat(date)) {
            throw new Error('Invalid date format. Expected YYYY-MM-DD');
        }
        if (time && !this._isValidTimeFormat(time)) {
            throw new Error('Invalid time format. Expected HH:MM');
        }
        if (!['personal', 'work', 'study', 'health', 'other'].includes(category)) {
            throw new Error('Invalid category');
        }
        if (!['low', 'medium', 'high'].includes(priority)) {
            throw new Error('Invalid priority');
        }

        this.id = id;
        this.title = title.trim();
        this.description = description.trim();
        this.date = date;
        this.time = time;
        this.category = category;
        this.priority = priority;
        this.completed = completed;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.completedAt = completedAt;
    }

    /**
     * Valida formato de data YYYY-MM-DD
     * @private
     */
    _isValidDateFormat(dateStr) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateStr)) return false;
        const date = new Date(dateStr + 'T00:00:00');
        return date instanceof Date && !isNaN(date) &&
               date.getFullYear() === parseInt(dateStr.slice(0, 4)) &&
               date.getMonth() === parseInt(dateStr.slice(5, 7)) - 1 &&
               date.getDate() === parseInt(dateStr.slice(8, 10));
    }

    /**
     * Valida formato de hora HH:MM
     * @private
     */
    _isValidTimeFormat(timeStr) {
        const regex = /^\d{2}:\d{2}$/;
        if (!regex.test(timeStr)) return false;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
    }

    /**
     * Marca a tarefa como concluída
     * @returns {Task} Nova instância com status atualizado (imutabilidade)
     */
    complete() {
        if (this.completed) return this;
        return new Task({
            ...this.toObject(),
            completed: true,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Reabre a tarefa (desmarca como concluída)
     * @returns {Task} Nova instância com status atualizado
     */
    reopen() {
        if (!this.completed) return this;
        return new Task({
            ...this.toObject(),
            completed: false,
            completedAt: null,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Atualiza propriedades da tarefa
     * @param {Partial<Task>} updates - Propriedades a atualizar
     * @returns {Task} Nova instância atualizada
     */
    update(updates) {
        const allowedFields = ['title', 'description', 'date', 'time', 'category', 'priority'];
        const filteredUpdates = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        return new Task({
            ...this.toObject(),
            ...filteredUpdates,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Verifica se a tarefa está atrasada
     * @returns {boolean}
     */
    isOverdue() {
        if (this.completed) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDate = new Date(this.date + 'T00:00:00');
        return taskDate < today;
    }

    /**
     * Verifica se a tarefa é para hoje
     * @returns {boolean}
     */
    isToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDate = new Date(this.date + 'T00:00:00');
        return taskDate.getTime() === today.getTime();
    }

    /**
     * Verifica se a tarefa é desta semana
     * @returns {boolean}
     */
    isThisWeek() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const taskDate = new Date(this.date + 'T00:00:00');
        return taskDate >= startOfWeek && taskDate <= endOfWeek;
    }

    /**
     * Verifica se a tarefa é deste mês
     * @returns {boolean}
     */
    isThisMonth() {
        const today = new Date();
        const taskDate = new Date(this.date + 'T00:00:00');
        return taskDate.getFullYear() === today.getFullYear() &&
               taskDate.getMonth() === today.getMonth();
    }

    /**
     * Converte para objeto plano (para serialização)
     * @returns {Object}
     */
    toObject() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            date: this.date,
            time: this.time,
            category: this.category,
            priority: this.priority,
            completed: this.completed,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            completedAt: this.completedAt
        };
    }

    /**
     * Cria instância a partir de objeto plano (desserialização)
     * @static
     * @param {Object} obj
     * @returns {Task}
     */
    static fromObject(obj) {
        return new Task(obj);
    }

    /**
     * Compara duas tarefas para ordenação
     * @static
     * @param {Task} a
     * @param {Task} b
     * @returns {number}
     */
    static compare(a, b) {
        // Primeiro por data
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;

        // Depois por horário (tarefas sem horário vão para o final)
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;

        // Depois por prioridade (high > medium > low)
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityCompare = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityCompare !== 0) return priorityCompare;

        // Por fim por título
        return a.title.localeCompare(b.title);
    }
}

/**
 * Value Object para filtros de tarefas
 */
export class TaskFilter {
    constructor({
        status = 'all', // all, pending, completed
        category = 'all',
        priority = 'all',
        dateRange = null // { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
    } = {}) {
        this.status = status;
        this.category = category;
        this.priority = priority;
        this.dateRange = dateRange;
    }

    /**
     * Verifica se uma tarefa passa no filtro
     * @param {Task} task
     * @returns {boolean}
     */
    matches(task) {
        if (this.status === 'pending' && task.completed) return false;
        if (this.status === 'completed' && !task.completed) return false;
        if (this.category !== 'all' && task.category !== this.category) return false;
        if (this.priority !== 'all' && task.priority !== this.priority) return false;
        if (this.dateRange) {
            const taskDate = new Date(task.date + 'T00:00:00');
            const start = new Date(this.dateRange.start + 'T00:00:00');
            const end = new Date(this.dateRange.end + 'T00:00:00');
            if (taskDate < start || taskDate > end) return false;
        }
        return true;
    }
}