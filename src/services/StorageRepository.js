/**
 * StorageRepository - Camada de abstração para persistência (localStorage)
 * Implementa o padrão Repository seguindo Dependency Inversion Principle
 */
export class StorageRepository {
    /**
     * @param {string} storageKey - Chave usada no localStorage
     */
    constructor(storageKey = 'task-scheduler-tasks') {
        this.storageKey = storageKey;
        this._validateStorage();
    }

    /**
     * Verifica disponibilidade do localStorage
     * @private
     */
    _validateStorage() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            this._available = true;
        } catch (e) {
            this._available = false;
            console.warn('localStorage not available, using in-memory fallback');
            this._memoryStore = new Map();
        }
    }

    /**
     * Obtém todas as tarefas do armazenamento
     * @returns {Promise<Array<Object>>}
     */
    async findAll() {
        if (this._available) {
            try {
                const data = localStorage.getItem(this.storageKey);
                return data ? JSON.parse(data) : [];
            } catch (e) {
                console.error('Error reading from localStorage:', e);
                return [];
            }
        }
        return Array.from(this._memoryStore.values());
    }

    /**
     * Busca tarefa por ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const tasks = await this.findAll();
        return tasks.find(t => t.id === id) || null;
    }

    /**
     * Salva uma nova tarefa
     * @param {Object} task - Objeto plano da tarefa
     * @returns {Promise<Object>} Tarefa salva
     */
    async save(task) {
        const tasks = await this.findAll();
        tasks.push(task);
        await this._persist(tasks);
        return task;
    }

    /**
     * Atualiza uma tarefa existente
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object|null>} Tarefa atualizada ou null se não encontrada
     */
    async update(id, updates) {
        const tasks = await this.findAll();
        const index = tasks.findIndex(t => t.id === id);
        if (index === -1) return null;

        tasks[index] = { ...tasks[index], ...updates };
        await this._persist(tasks);
        return tasks[index];
    }

    /**
     * Remove uma tarefa
     * @param {string} id
     * @returns {Promise<boolean>} True se removida com sucesso
     */
    async delete(id) {
        const tasks = await this.findAll();
        const filtered = tasks.filter(t => t.id !== id);
        if (filtered.length === tasks.length) return false;
        await this._persist(filtered);
        return true;
    }

    /**
     * Remove múltiplas tarefas
     * @param {string[]} ids
     * @returns {Promise<number>} Quantidade removida
     */
    async deleteMany(ids) {
        const tasks = await this.findAll();
        const initialLength = tasks.length;
        const filtered = tasks.filter(t => !ids.includes(t.id));
        await this._persist(filtered);
        return initialLength - filtered.length;
    }

    /**
     * Limpa todas as tarefas concluídas
     * @returns {Promise<number>} Quantidade removida
     */
    async clearCompleted() {
        const tasks = await this.findAll();
        const initialLength = tasks.length;
        const filtered = tasks.filter(t => !t.completed);
        await this._persist(filtered);
        return initialLength - filtered.length;
    }

    /**
     * Persiste array de tarefas no storage
     * @private
     * @param {Array<Object>} tasks
     */
    async _persist(tasks) {
        if (this._available) {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(tasks));
            } catch (e) {
                console.error('Error writing to localStorage:', e);
                throw new Error('Failed to save tasks. Storage may be full.');
            }
        } else {
            this._memoryStore.clear();
            tasks.forEach(t => this._memoryStore.set(t.id, t));
        }
    }

    /**
     * Exporta todos os dados para backup
     * @returns {Promise<string>} JSON string
     */
    async export() {
        const tasks = await this.findAll();
        return JSON.stringify({
            version: '1.0',
            exportedAt: new Date().toISOString(),
            tasks
        }, null, 2);
    }

    /**
     * Importa dados de backup
     * @param {string} jsonData
     * @returns {Promise<number>} Quantidade de tarefas importadas
     */
    async import(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            const tasks = data.tasks || [];
            await this._persist(tasks);
            return tasks.length;
        } catch (e) {
            throw new Error('Invalid backup format');
        }
    }
}

/**
 * Interface do Repository (para Dependency Inversion)
 * Permite trocar implementação (localStorage, IndexedDB, API, etc.)
 */
export const ITaskRepository = {
    findAll: async () => [],
    findById: async (id) => null,
    save: async (task) => task,
    update: async (id, updates) => null,
    delete: async (id) => false,
    deleteMany: async (ids) => 0,
    clearCompleted: async () => 0
};