const express = require("express");
const orderStore = require("./orders");
const {
  makeOrderId,
  calculateTotal,
  orderResponse,
  validationProblem,
  notFoundProblem,
  validateCreateOrder,
  normalizeItems,
  persistOrderWithContext,
  verifyOrderStateForRemoval,
} = require("./services");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const API_VERSION = "1.0";
const DEFAULT_ORDER_STATUS = "created";

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    version: API_VERSION,
  });
});

app.post("/orders", async (req, res, next) => {
  try {
    const validationErrors = validateCreateOrder(req.body);

    if (validationErrors.length > 0) {
      return res
        .status(400)
        .json(validationProblem("Invalid order", validationErrors));
    }

    const normalizedCustomerName = req.body.customerName.trim();
    const items = normalizeItems(req.body.items);
    const serverCalculatedTotal = calculateTotal(items);
    const status = DEFAULT_ORDER_STATUS;

    const newOrder = {
      id: makeOrderId(),
      customerName: normalizedCustomerName,
      items,
      total: serverCalculatedTotal,
      status,
      createdAt: new Date().toISOString(),
    };

    const storedOrder = await persistOrderWithContext(newOrder, orderStore);
    const responseBody = orderResponse(storedOrder);

    return res
      .status(201)
      .location(`/orders/${storedOrder.id}`)
      .json(responseBody);
  } catch (error) {
    return next(error);
  }
});

app.get("/orders", (req, res) => {
  const orders = orderStore.getAllOrders();
  const result = orders.map((order) => orderResponse(order));
  const responseBody = {
    orders: result,
    count: result.length,
  };

  res.status(200).json(responseBody);
});

app.get("/orders/:id", async (req, res, next) => {
  try {
    const requestedId = req.params.id;
    const matchingOrder = orderStore.findOrderById(requestedId);

    if (!matchingOrder) {
      return res.status(404).json(notFoundProblem());
    }

    const responseBody = orderResponse(matchingOrder);
    return res.status(200).json(responseBody);
  } catch (error) {
    return next(error);
  }
});

app.delete("/orders/:id", async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const existingOrder = orderStore.findOrderById(orderId);

    if (!existingOrder) {
      return res.status(404).json(notFoundProblem());
    }

    await verifyOrderStateForRemoval(existingOrder);

    const removedOrder = orderStore.removeOrder(orderId);
    if (!removedOrder) {
      return res.status(404).json(notFoundProblem());
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "Route not found",
    },
  });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json(
      validationProblem("Invalid JSON body", [
        "Request body must contain valid JSON",
      ]),
    );
  }

  console.error(error);
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error",
    },
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Orders API is running on http://localhost:${PORT}`);
  });
}

module.exports = app;