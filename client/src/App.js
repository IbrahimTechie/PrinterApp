// client/src/Dashboard.js
import { useEffect, useState } from "react";

const Dashboard = () => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch("http://localhost:5000/orders");
        const data = await response.json();
        setPendingOrders(data.pending);
        setCompletedOrders(data.completed);
      } catch (error) {
        console.error("Error fetching orders:", error);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#121212",
        color: "#fff",
        paddingBlock: "10px",
        paddingInline: "24px"
      }}
    >
      <h1
        style={{
          textAlign: "center",
          fontSize: "24px",
          fontWeight: "bold",
          marginBottom: "20px",
        }}
      >
        ⭐ WUNSCH-DRUCKER ⭐
      </h1>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}
      >
        {/* Pending Orders */}
        <div
          style={{
            backgroundColor: "#1E1E1E",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          }}
        >
          <h2
            style={{ fontSize: "20px", color: "#FFC107", margin: "0px" }}
          >
            🟡 Offene Wünsche
          </h2>
          {pendingOrders.length === 0 ? (
            <p style={{ color: "#888" }}>keine offenen Wünsche</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {pendingOrders.map((order, index) => (
                <li
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#292929",
                    padding: "12px",
                    borderRadius: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <span>
                    {order.orderName} (x{order.quantity})
                  </span>
                  <span
                    style={{
                      backgroundColor: "#FFC107",
                      color: "#000",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      marginTop: "4px",
                    }}
                  >
                    Status: {order.printingStatus || "Not set"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Completed Orders */}
        <div
          style={{
            backgroundColor: "#1E1E1E",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          }}
        >
          <h2
            style={{ fontSize: "20px", color: "#4CAF50", margin: "0px" }}
          >
            ✅ Gedruckte Wünsche
          </h2>
          {completedOrders.length === 0 ? (
            <p style={{ color: "#888" }}>keine gedruckten Wünsche</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {completedOrders.map((order, index) => (
                <li
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#292929",
                    padding: "12px",
                    borderRadius: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <span>
                    {order.orderName} (x{order.quantity})
                  </span>
                  <span
                    style={{
                      backgroundColor: "#4CAF50",
                      color: "#000",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      marginTop: "4px",
                    }}
                  >
                    Printing status: {order.printingStatus || "Not set"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
