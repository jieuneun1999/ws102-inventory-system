import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Menu } from "./pages/Menu";
import { OrderTracking } from "./pages/OrderTracking";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { CartPage } from "./components/CartPage";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "menu", Component: Menu },
      { path: "cart", Component: CartPage },
      { path: "track", Component: OrderTracking },
      { path: "track/:orderId", Component: OrderTracking },
      { path: "auth", Component: Auth },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "reset-password", Component: ResetPassword },
      { path: "dashboard", Component: Dashboard },
      { path: "*", Component: Home },
    ],
  },
]);
