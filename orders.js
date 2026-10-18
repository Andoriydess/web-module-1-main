const orders = [];

module.exports = {
  orders,
  addOrder(order) {
    orders.push(order);
    return order;
  },
  findOrderById(id) {
    return orders.find((order) => order.id === id);
  },
  removeOrder(id) {
    const index = orders.findIndex((order) => order.id === id);
    if (index !== -1) {
      return orders.splice(index, 1)[0];
    }
    return null;
  },
  getAllOrders() {
    return orders;
  }
};