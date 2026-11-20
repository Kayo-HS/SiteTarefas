/**
 * RouterService - Roteamento SPA sem recarregamento (zero delay)
 * Gerencia navegação entre views e estado da URL via History API
 */
export class RouterService {
    /**
     * @param {Object} options
     * @param {string} [options.root='/'] - Caminho base da aplicação
     */
    constructor(options = {}) {
        this._root = options.root || '/';
        this._routes = new Map();
        this._currentRoute = null;
        this._listeners = new Set();
        this._initialized = false;

        // Bind para preservar contexto
        this._onPopState = this._onPopState.bind(this);
        this._onClick = this._onClick.bind(this);
    }

    /**
     * Inicializa o roteador
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;

        window.addEventListener('popstate', this._onPopState);
        document.body.addEventListener('click', this._onClick, true);

        // Rota inicial
        this._navigate(window.location.pathname + window.location.search, false);
    }

    /**
     * Registra uma rota
     * @param {string} path - Caminho da rota (ex: '/calendar/:mode')
     * @param {Function} handler - Função handler (recebe params)
     */
    addRoute(path, handler) {
        const regex = this._pathToRegex(path);
        this._routes.set(path, { regex, handler, path });
    }

    /**
     * Navega para uma rota programaticamente
     * @param {string} path
     * @param {boolean} [pushState=true] - Se deve adicionar ao histórico
     */
    navigate(path, pushState = true) {
        this._navigate(path, pushState);
    }

    /**
     * Navegação interna
     * @private
     */
    _navigate(path, pushState) {
        // Normaliza path removendo root
        let normalizedPath = path;
        if (this._root !== '/' && path.startsWith(this._root)) {
            normalizedPath = path.slice(this._root.length - 1) || '/';
        }

        const match = this._matchRoute(normalizedPath);

        if (pushState) {
            const fullPath = this._root === '/' ? normalizedPath : this._root + normalizedPath.slice(1);
            window.history.pushState({}, '', fullPath);
        }

        this._currentRoute = match;
        this._notifyListeners(match);
    }

    /**
     * Handler do evento popstate (botão voltar/avançar do navegador)
     * @private
     */
    _onPopState() {
        this._navigate(window.location.pathname + window.location.search, false);
    }

    /**
     * Handler de cliques em links internos
     * @private
     */
    _onClick(event) {
        const link = event.target.closest('a[data-router], [data-view]');
        if (!link) return;

        // Previne navegação padrão para links internos
        if (link.hasAttribute('data-view')) {
            event.preventDefault();
            const view = link.getAttribute('data-view');
            this.navigate(`/view/${view}`);
        } else if (link.hasAttribute('data-router')) {
            event.preventDefault();
            const href = link.getAttribute('href');
            this.navigate(href);
        }
    }

    /**
     * Converte path com parâmetros para RegExp
     * @private
     */
    _pathToRegex(path) {
        const regexStr = path
            .replace(/\//g, '\\/')
            .replace(/:(\w+)/g, '(?<$1>[^/]+)')
            .replace(/\*/g, '.*');
        return new RegExp(`^${regexStr}$`);
    }

    /**
     * Tenta match da rota atual
     * @private
     */
    _matchRoute(path) {
        for (const [routePath, route] of this._routes) {
            const match = path.match(route.regex);
            if (match) {
                return {
                    path: routePath,
                    params: match.groups || {},
                    query: this._parseQuery(window.location.search)
                };
            }
        }
        // Fallback para rota não encontrada
        return {
            path: '*',
            params: {},
            query: this._parseQuery(window.location.search)
        };
    }

    /**
     * Parse de query string
     * @private
     */
    _parseQuery(search) {
        const params = new URLSearchParams(search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    }

    /**
     * Notifica listeners de mudança de rota
     * @private
     */
    _notifyListeners(route) {
        for (const listener of this._listeners) {
            try {
                listener(route);
            } catch (e) {
                console.error('Router listener error:', e);
            }
        }
    }

    /**
     * Adiciona listener de mudança de rota
     * @param {Function} listener
     * @returns {Function} Função para remover listener
     */
    onRouteChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /**
     * Obtém rota atual
     * @returns {Object|null}
     */
    getCurrentRoute() {
        return this._currentRoute;
    }

    /**
     * Gera URL para uma rota com parâmetros
     * @param {string} routePath
     * @param {Object} params
     * @returns {string}
     */
    generateUrl(routePath, params = {}) {
        let url = routePath;
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`:${key}`, encodeURIComponent(value));
        }
        return this._root === '/' ? url : this._root + url.slice(1);
    }

    /**
     * Destroi o roteador (cleanup)
     */
    destroy() {
        window.removeEventListener('popstate', this._onPopState);
        document.body.removeEventListener('click', this._onClick, true);
        this._listeners.clear();
        this._initialized = false;
    }
}

/**
 * ViewRouter - Roteador simplificado para views baseadas em data-view
 * Mais leve que RouterService completo, ideal para navegação por abas
 */
export class ViewRouter {
    /**
     * @param {Object} options
     * @param {string} [options.defaultView='create'] - View padrão
     * @param {boolean} [options.useHash=false] - Usar hash (#) em vez de History API
     */
    constructor(options = {}) {
        this._defaultView = options.defaultView || 'create';
        this._useHash = options.useHash || false;
        this._currentView = null;
        this._listeners = new Set();
        this._viewElements = new Map();

        this._onHashChange = this._onHashChange.bind(this);
    }

    /**
     * Inicializa o roteador de views
     * @param {HTMLElement} container - Elemento pai contendo as views
     */
    init(container) {
        this._container = container;

        // Registra views encontradas no DOM
        const views = container.querySelectorAll('[data-view-id]');
        views.forEach(view => {
            this._viewElements.set(view.dataset.viewId, view);
        });

        if (this._useHash) {
            window.addEventListener('hashchange', this._onHashChange);
            this._navigateTo(this._getHashView() || this._defaultView, false);
        } else {
            this._navigateTo(this._defaultView, false);
        }
    }

    /**
     * Navega para uma view
     * @param {string} viewId
     * @param {boolean} [pushState=true]
     */
    navigate(viewId, pushState = true) {
        if (!this._viewElements.has(viewId)) {
            console.warn(`View "${viewId}" not found`);
            return false;
        }

        this._navigateTo(viewId, pushState);
        return true;
    }

    /**
     * Navegação interna
     * @private
     */
    _navigateTo(viewId, pushState) {
        if (this._currentView === viewId) return;

        // Esconde view atual
        if (this._currentView && this._viewElements.has(this._currentView)) {
            this._viewElements.get(this._currentView).classList.remove('active');
            this._viewElements.get(this._currentView).hidden = true;
        }

        // Mostra nova view
        const newView = this._viewElements.get(viewId);
        newView.classList.add('active');
        newView.hidden = false;

        this._currentView = viewId;

        // Atualiza URL
        if (pushState) {
            if (this._useHash) {
                window.location.hash = viewId;
            } else {
                const url = `/view/${viewId}`;
                window.history.pushState({ view: viewId }, '', url);
            }
        }

        this._notifyListeners(viewId);
    }

    /**
     * Handler de hashchange
     * @private
     */
    _onHashChange() {
        const view = this._getHashView();
        if (view && view !== this._currentView) {
            this._navigateTo(view, false);
        }
    }

    /**
     * Obtém view do hash
     * @private
     */
    _getHashView() {
        const hash = window.location.hash.slice(1);
        return hash || null;
    }

    /**
     * Notifica listeners
     * @private
     */
    _notifyListeners(viewId) {
        for (const listener of this._listeners) {
            try {
                listener(viewId);
            } catch (e) {
                console.error('ViewRouter listener error:', e);
            }
        }
    }

    /**
     * Adiciona listener
     * @param {Function} listener
     * @returns {Function} Cleanup function
     */
    onViewChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /**
     * Obtém view atual
     * @returns {string|null}
     */
    getCurrentView() {
        return this._currentView;
    }

    /**
     * Registra view dinamicamente
     * @param {string} viewId
     * @param {HTMLElement} element
     */
    registerView(viewId, element) {
        element.dataset.viewId = viewId;
        this._viewElements.set(viewId, element);
    }

    /**
     * Destroi o roteador
     */
    destroy() {
        if (this._useHash) {
            window.removeEventListener('hashchange', this._onHashChange);
        }
        this._listeners.clear();
    }
}