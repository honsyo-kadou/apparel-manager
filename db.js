const DB_NAME = 'ApparelManagerDB';
const STORE_NAME = 'products';
const DB_VERSION = 1;

const db = {
    // Open Database
    open: () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (e) => {
                resolve(e.target.result);
            };

            request.onerror = (e) => {
                reject(e.target.error);
            };
        });
    },

    // Get All Products
    getAllProducts: async () => {
        const database = await db.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Save Product (Add or Update)
    saveProduct: async (product) => {
        const database = await db.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(product); // put handles both add and update

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Delete Product
    deleteProduct: async (id) => {
        const database = await db.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Migrate from LocalStorage
    migrateFromLocalStorage: async () => {
        const rawData = localStorage.getItem('apparel_products');
        if (!rawData) return false;

        const products = JSON.parse(rawData);
        if (products.length === 0) return false;

        const database = await db.open();
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        for (const product of products) {
            store.put(product);
        }

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                console.log('Migration complete. Clearing LocalStorage.');
                localStorage.removeItem('apparel_products');
                resolve(true);
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }
};

// Expose globally
window.db = db;
