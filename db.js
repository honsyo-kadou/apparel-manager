const DB_NAME = 'ApparelManagerDB';
const STORE_NAME = 'products';
const DB_VERSION = 4; // Bump to 4 to ensure drafts store is created

const db = {
    // Open Database
    open: () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Create products store if not exists
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
                // Create drafts store if not exists (NEW)
                if (!db.objectStoreNames.contains('drafts')) {
                    db.createObjectStore('drafts', { keyPath: 'id' });
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

    // --- Draft Methods (NEW) ---

    // Get Draft
    getDraft: async () => {
        const database = await db.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(['drafts'], 'readonly');
            const store = transaction.objectStore('drafts');
            // We only have one draft for 'new_product'
            const request = store.get('new_product_draft');

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            // Note: If no draft exists, result is undefined (not error)
        });
    },

    // Save Draft
    saveDraft: async (draftData) => {
        const database = await db.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(['drafts'], 'readwrite');
            const store = transaction.objectStore('drafts');
            // Ensure fixed ID
            draftData.id = 'new_product_draft';
            const request = store.put(draftData);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Delete Draft
    deleteDraft: async () => {
        const database = await db.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(['drafts'], 'readwrite');
            const store = transaction.objectStore('drafts');
            const request = store.delete('new_product_draft');

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
