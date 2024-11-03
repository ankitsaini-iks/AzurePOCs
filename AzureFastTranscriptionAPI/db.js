const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
const databaseId = process.env.COSMOS_DB_DATABASE_ID;
const containerId = process.env.COSMOS_DB_CONTAINER_ID;

const client = new CosmosClient(connectionString);
const database = client.database(databaseId);
const container = database.container(containerId);

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
    getItemById
};