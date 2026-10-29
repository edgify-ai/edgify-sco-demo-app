// Utility functions for the Electron app
export const createPageUrl = (pageName) => {
    return `/${pageName.toLowerCase()}`;
};

// Database helper functions
export const dbAPI = {
    getProducts: () => window.electronAPI?.getProducts() || Promise.resolve([]),
    getCategories: () => window.electronAPI?.getCategories() || Promise.resolve([]),
    getConfig: () => window.electronAPI?.getConfig() || Promise.resolve({}),
    addProduct: (product) => window.electronAPI?.addProduct(product) || Promise.resolve({}),
    addCategory: (categoryName) => window.electronAPI?.addCategory(categoryName) || Promise.resolve({}),
    updateConfig: (config) => window.electronAPI?.updateConfig(config) || Promise.resolve({}),
    deleteCategory: (categoryId) => window.electronAPI?.deleteCategory(categoryId) || Promise.resolve({}),
    showOpenDialog: () => window.electronAPI?.showOpenDialog() || Promise.resolve({ canceled: true }),
};