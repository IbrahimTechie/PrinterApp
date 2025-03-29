import { useEffect, useState } from "react";

const POLL_INTERVAL = 5; // in seconds

const Dashboard = () => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(POLL_INTERVAL);

  useEffect(() => {
    let fetchInProgress = false;

    const fetchOrders = async () => {
      fetchInProgress = true;
      setLoading(true);
      try {
        const response = await fetch("http://localhost:5000/orders");
        const data = await response.json();
        setPendingOrders(data.pending);
        setCompletedOrders(data.completed);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
        fetchInProgress = false;
        setTimeLeft(POLL_INTERVAL); // reset timer after fetch
      }
    };

    fetchOrders(); // Initial fetch

    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : POLL_INTERVAL));
    }, 1000);

    const pollingInterval = setInterval(() => {
      if (!fetchInProgress) {
        fetchOrders();
      }
    }, POLL_INTERVAL * 1000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(pollingInterval);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#121212",
        color: "#fff",
        paddingBlock: "10px",
        paddingInline: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          ⭐ WUNSCH-ERFÜLLER ⭐
        </h1>

        {/* Timer Box */}
        <div
          style={{
            position: "absolute",
            right: 0,
            backgroundColor: "#1E1E1E",
            padding: "10px 16px",
            borderRadius: "8px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            minWidth: "140px",
            justifyContent: "center",
          }}
        >
          {loading ? (
            <div
              style={{
                width: "18px",
                height: "18px",
                border: "3px solid #FFC107",
                borderTop: "3px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          ) : (
            <span>Nach Wünschen suchen: {timeLeft}s</span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginTop: "20px",
        }}
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
          <h2 style={{ fontSize: "20px", color: "#FFC107", margin: "0px" }}>
            🟡 Offene Wünsche
          </h2>
          {pendingOrders.length === 0 ? (
            <p style={{ color: "#888", paddingLeft: '5px' }}>Keine offenen Wünsche!</p>
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
                    {order.orderName}: {order.productName} {order.variantName} (
                    {order.index}/{order.quantity})
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
          <h2 style={{ fontSize: "20px", color: "#4CAF50", margin: "0px" }}>
            ✅ Erfüllte Wünsche
          </h2>
          {completedOrders.length === 0 ? (
            <p style={{ color: "#888", paddingLeft: '5px' }}>Noch keine Wünsche erfüllt!</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {completedOrders
                .slice()
                .reverse()
                .map((order, index) => (
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
                      {order.orderName}: {order.productName} {order.variantName}{" "}
                      ({order.index}/{order.quantity})
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
                      Status: {order.printingStatus || "Not set"}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default Dashboard;
