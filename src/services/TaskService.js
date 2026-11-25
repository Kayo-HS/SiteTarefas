import { Task, TaskFilter } from '../domain/Task.js';
import { StorageRepository } from './StorageRepository.js';

/**
 * TaskService - Camada de serviço com regras de negócio
 * Orquestra Repository e Domain Models (Single Responsibility)
 */
export class TaskService {
    /**
     * @param {StorageRepository} repository - Implementação do repositório (DI)
     */
    constructor(repository) {
        if (!repository || typeof repository.findAll !== 'function') {
            throw new Error('Valid repository implementation required');
        }
        this._repository = repository;
    }

    /**
     * Cria uma nova tarefa
     * @param {Object} taskData - Dados da tarefa
     * @returns {Promise<Task>}
     */
    async createTask(taskData) {
        const task = new Task(taskData);
        await this._repository.save(task.toObject());
        return task;
    }

    /**
     * Busca tarefa por ID
     * @param {string} id
     * @returns {Promise<Task|null>}
     */
    async getTask(id) {
        const data = await this._repository.findById(id);
        return data ? Task.fromObject(data) : null;
    }

    /**
     * Lista todas as tarefas (com filtro opcional)
     * @param {TaskFilter} [filter]
     * @returns {Promise<Task[]>}
     */
    async listTasks(filter = null) {
        const allData = await this._repository.findAll();
        let tasks = allData.map(d => Task.fromObject(d));

        if (filter) {
            tasks = tasks.filter(t => filter.matches(t));
        }

        return tasks.sort(Task.compare);
    }

    /**
     * Lista tarefas pendentes
     * @param {TaskFilter} [additionalFilter]
     * @returns {Promise<Task[]>}
     */
    async listPending(additionalFilter = null) {
        const baseFilter = new TaskFilter({ status: 'pending' });
        const combinedFilter = additionalFilter
            ? this._combineFilters(baseFilter, additionalFilter)
            : baseFilter;
        return this.listTasks(combinedFilter);
    }

    /**
     * Lista tarefas concluídas
     * @param {TaskFilter} [additionalFilter]
     * @returns {Promise<Task[]>}
     */
    async listCompleted(additionalFilter = null) {
        const baseFilter = new TaskFilter({ status: 'completed' });
        const combinedFilter = additionalFilter
            ? this._combineFilters(baseFilter, additionalFilter)
            : baseFilter;
        return this.listTasks(combinedFilter);
    }

    /**
     * Combina dois filtros (AND lógico)
     * @private
     */
    _combineFilters(filter1, filter2) {
        return new TaskFilter({
            status: filter2.status !== 'all' ? filter2.status : filter1.status,
            category: filter2.category !== 'all' ? filter2.category : filter1.category,
            priority: filter2.priority !== 'all' ? filter2.priority : filter1.priority,
            dateRange: filter2.dateRange || filter1.dateRange
        });
    }

    /**
     * Atualiza uma tarefa
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Task|null>}
     */
    async updateTask(id, updates) {
        const existing = await this.getTask(id);
        if (!existing) return null;

        const updated = existing.update(updates);
        await this._repository.update(id, updated.toObject());
        return updated;
    }

    /**
     * Alterna status de conclusão da tarefa
     * @param {string} id
     * @returns {Promise<Task|null>}
     */
    async toggleComplete(id) {
        const task = await this.getTask(id);
        if (!task) return null;

        const updated = task.completed ? task.reopen() : task.complete();
        await this._repository.update(id, updated.toObject());
        return updated;
    }

    /**
     * Exclui uma tarefa
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteTask(id) {
        return this._repository.delete(id);
    }

    /**
     * Exclui múltiplas tarefas
     * @param {string[]} ids
     * @returns {Promise<number>}
     */
    async deleteTasks(ids) {
        return this._repository.deleteMany(ids);
    }

    /**
     * Limpa todas as tarefas concluídas
     * @returns {Promise<number>}
     */
    async clearCompleted() {
        return this._repository.clearCompleted();
    }

    /**
     * Obtém contadores para badges
     * @returns {Promise<Object>}
     */
    async getCounts() {
        const allData = await this._repository.findAll();
        const tasks = allData.map(d => Task.fromObject(d));
        return {
            total: tasks.length,
            pending: tasks.filter(t => !t.completed).length,
            completed: tasks.filter(t => t.completed).length,
            overdue: tasks.filter(t => !t.completed && t.isOverdue()).length,
            today: tasks.filter(t => !t.completed && t.isToday()).length
        };
    }

    /**
     * Obtém tarefas para um intervalo de datas (para calendário)
     * @param {string} startDate - YYYY-MM-DD
     * @param {string} endDate - YYYY-MM-DD
     * @returns {Promise<Task[]>}
     */
    async getTasksInRange(startDate, endDate) {
        const filter = new TaskFilter({
            dateRange: { start: startDate, end: endDate }
        });
        return this.listTasks(filter);
    }

    /**
     * Obtém tarefas de um ano específico
     * @param {number} year
     * @returns {Promise<Task[]>}
     */
    async getTasksByYear(year) {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
        return this.getTasksInRange(start, end);
    }

    /**
     * Obtém tarefas de um mês específico
     * @param {number} year
     * @param {number} month (0-11)
     * @returns {Promise<Task[]>}
     */
    async getTasksByMonth(year, month) {
        const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const end = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
        return this.getTasksInRange(start, end);
    }

    /**
     * Obtém tarefas de uma semana específica
     * @param {Date} weekStart - Início da semana (Domingo)
     * @returns {Promise<Task[]>}
     */
    async getTasksByWeek(weekStart) {
        const start = weekStart.toISOString().split('T')[0];
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        const endStr = end.toISOString().split('T')[0];
        return this.getTasksInRange(start, endStr);
    }

    /**
     * Obtém tarefas de um dia específico
     * @param {Date} date
     * @returns {Promise<Task[]>}
     */
    async getTasksByDay(date) {
        const dateStr = date.toISOString().split('T')[0];
        const filter = new TaskFilter({
            dateRange: { start: dateStr, end: dateStr }
        });
        return this.listTasks(filter);
    }

    /**
     * Exporta dados para backup
     * @returns {Promise<string>}
     */
    async exportData() {
        return this._repository.export();
    }

    /**
     * Importa dados de backup
     * @param {string} jsonData
     * @returns {Promise<number>}
     */
    async importData(jsonData) {
        return this._repository.import(jsonData);
    }
}