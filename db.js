const { CosmosClient } = require("@azure/cosmos");

const COSMOS_DB_CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION_STRING;
const COSMOS_DB_DATABASE_ID = process.env.COSMOS_DB_DATABASE_ID;
const COSMOS_DB_CONTAINER_ID = process.env.COSMOS_DB_CONTAINER_ID;

if (!COSMOS_DB_CONTAINER_ID || !COSMOS_DB_DATABASE_ID || !COSMOS_DB_CONNECTION_STRING) {
    throw new Error('Missing required environment variables for DB');
}

let client, database, container;

function initialiseDb() {
    client = new CosmosClient(COSMOS_DB_CONNECTION_STRING);
    database = client.database(COSMOS_DB_DATABASE_ID);
    container = database.container(COSMOS_DB_CONTAINER_ID);
}

async function createItem(item) {
    const { resource: createdItem } = await container.items.create(item);
    return createdItem;
}

async function readItem(id, partitionKey) {
    const { resource: item } = await container.item(id, partitionKey).read();
    return item;
}

async function updateItem(id, partitionKey, item) {
    const { resource: updatedItem } = await container.item(id, partitionKey).replace(item);
    return updatedItem;
}

async function deleteItem(id, partitionKey) {
    const { resource: result } = await container.item(id, partitionKey).delete();
    return result;
}
async function getItemById(id, partitionKey) {
    const { resource: item } = await container.item(id, partitionKey).read();
    return item;
}

module.exports = {
    createItem,
    readItem,
    updateItem,
    deleteItem,
    getItemById,
    initialiseDb
};