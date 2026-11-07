
import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import Dashboard from "./pages/Dashboard";
import NewReview from "./pages/NewReview";
import Documents from "./pages/Documents";
import PolicyLibrary from "./pages/PolicyLibrary";
import Settings from "./pages/Settings";

import Login from "./pages/Login";
import Register from "./pages/Register";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import ReviewDetails from "./pages/ReviewDetails";

import {
  fetchCurrentUser,
  clearAuth,
} from "./features/auth/authSlice";

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(fetchCurrentUser());

    const handleExpiredSession = () => {
      dispatch(clearAuth());
      navigate("/login", { replace: true });
    };

    window.addEventListener("auth:expired", handleExpiredSession);

    return () => {
      window.removeEventListener("auth:expired", handleExpiredSession);
    };
  }, [dispatch, navigate]);

  return (

    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Authenticated routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>

          <Route path="/" element={<Dashboard />} />
          <Route path="/new-review" element={<NewReview />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/reviews/:id"
            element={<ReviewDetails />}
          />

          {/* Admin-only */}
          {/* <Route element={<ProtectedRoute allowedRoles={["admin"]} />}> */}
          <Route path="/policies" element={<PolicyLibrary />} />
          {/* </Route> */}

        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>

  );
}

export default App;
