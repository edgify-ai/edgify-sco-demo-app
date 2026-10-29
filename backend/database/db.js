// backend/database/db.js
const path = require('path');
const knex = require('knex');

let db;

function init(dbPath) {
    db = knex({
        client: 'better-sqlite3',
        connection: {
            filename: dbPath,
        },
        useNullAsDefault: true,
    });
    console.log(`Database connected at: ${dbPath}`);
}

async function initializeDatabase() {
  if (!db) throw new Error('Database has not been initialized. Call init() first.');
  
  if (!(await db.schema.hasTable('config'))) {
    console.log('Creating config table...');
    await db.schema.createTable('config', (table) => {
      table.string('key').primary();
      table.string('value');
    });
    // Add all config keys, including the new ones for the session agent
    await db('config').insert([
        { key: 'logo_url', value: 'https://uploads-ssl.webflow.com/62493653455853232b376c33/62493722455853634e376d8b_Edgify_Logo_Full_Colour_Black.svg' },
        { key: 'background_image_url', value: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?q=80&w=2000&auto-format&fit=crop' },
        { key: 'scanner_model', value: 'keyboard_wedge' },
        { key: 'keyboard_scanner_timeout', value: '500' },
        
        // Prediction Agent Settings (renamed from generic edgify_)
        { key: 'edgify_prediction_enabled', value: 'false' },
        { key: 'edgify_prediction_host', value: 'localhost' },
        { key: 'edgify_prediction_port', value: '8090' },
        { key: 'edgify_prediction_token', value: '' },
        { key: 'edgify_prediction_ping_interval', value: '5000' },

        // NEW: Session Agent Settings
        { key: 'edgify_session_enabled', value: 'false' },
        { key: 'edgify_session_host', value: 'localhost' },
        { key: 'edgify_session_port', value: '8091' }, // Note: Different default port
        { key: 'edgify_session_token', value: '' },

        // RFID Reader Settings
        { key: 'rfid_enabled', value: 'false' },
        { key: 'rfid_host', value: 'localhost' },
        { key: 'rfid_port', value: '8080' },
        { key: 'rfid_tx_power', value: '2700' },
        { key: 'rfid_antennas', value: '6,8' }
    ]);
  } else {
    // Ensure RFID defaults exist on previously-initialized databases
    const rfidDefaults = [
        { key: 'rfid_enabled', value: 'false' },
        { key: 'rfid_host', value: 'localhost' },
        { key: 'rfid_port', value: '8080' },
        { key: 'rfid_tx_power', value: '2700' },
        { key: 'rfid_antennas', value: '6,8' }
    ];
    for (const row of rfidDefaults) {
        const existing = await db('config').where({ key: row.key }).first();
        if (!existing) {
            console.log(`Migration: Adding default config '${row.key}'`);
            await db('config').insert(row);
        }
    }
  }

  if (!(await db.schema.hasTable('categories'))) {
    console.log('Creating categories table...');
    await db.schema.createTable('categories', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
    });
    await db('categories').insert([
        { name: 'Fruits' }, { name: 'Vegetables' }, { name: 'Bakery' }, { name: 'General' }
    ]);
  }

  if (!(await db.schema.hasTable('products'))) {
    console.log('Creating products table...');
    await db.schema.createTable('products', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('image_url');
      table.decimal('price', 8, 2).notNullable();
      table.boolean('is_weight_based').defaultTo(false);
      table.integer('category_id').unsigned().references('id').inTable('categories');
      table.boolean('enabled').notNullable().defaultTo(true);
      table.string('product_type').notNullable().defaultTo('quantity');
    });
    await db('products').insert([
        { id: '737628064502', name: 'Coca-Cola Can', image_url: 'https://i.imgur.com/W5yVf3O.png', price: 1.50, is_weight_based: false, category_id: 4, enabled: true, product_type: 'quantity' },
        { id: '049000042566', name: 'Pepsi Can', image_url: 'https://i.imgur.com/I2hFf5Y.png', price: 1.50, is_weight_based: false, category_id: 4, enabled: true, product_type: 'quantity' },
        { id: 'zucchini-pred', name: 'Zucchini', image_url: 'https://i.imgur.com/M6JQH4Z.png', price: 5.60, is_weight_based: true, category_id: 2, enabled: true, product_type: 'weight' },
    ]);
  } else {
    if (!(await db.schema.hasColumn('products', 'enabled'))) {
        console.log("Migration: Adding 'enabled' column to products table...");
        await db.schema.alterTable('products', (table) => {
            table.boolean('enabled').notNullable().defaultTo(true);
        });
    }
    if (!(await db.schema.hasColumn('products', 'product_type'))) {
        console.log("Migration: Adding 'product_type' column to products table...");
        await db.schema.alterTable('products', (table) => {
            table.string('product_type').notNullable().defaultTo('quantity');
        });
        await db('products')
            .where({ is_weight_based: true })
            .update({ product_type: 'weight' });
    }
  }

  console.log('Database schema is ready.');
}

const getDb = () => db;
module.exports = { init, initializeDatabase, getDb };