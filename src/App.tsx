import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { AppProvider } from "@/contexts/AppContext";
import { SupabaseInitializer } from "@/components/common/SupabaseInitializer";
import { CriticalResourcePreloader } from "@/components/common/CriticalResourcePreloader";
import { AppInitializer } from "@/components/AppInitializer";
import Index from "./pages/Index";
import OptimizedLandingPage from "./pages/OptimizedLandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RegisterWithPlanPage from "./pages/RegisterWithPlanPage";
import CheckoutPage from "./pages/CheckoutPage";
import PlanChangeCheckoutPage from "./pages/PlanChangeCheckoutPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProfilePage from "./pages/ProfilePage";
import TransactionsPage from "./pages/TransactionsPage";
import ExpensesPage from "./pages/ExpensesPage";
import GoalsPage from "./pages/GoalsPage";
import ReportsPage from "./pages/ReportsPage";
import SchedulePage from "./pages/SchedulePage";
import SettingsPage from "./pages/SettingsPage";
import CategoriesPage from "./pages/CategoriesPage";
import PlansPage from "./pages/PlansPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentConfirmationPage from "./pages/PaymentConfirmationPage";
import ThankYouPage from "./pages/ThankYouPage";
import AdminDashboard from "./pages/AdminDashboard";
import AchievementsPage from "./pages/AchievementsPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import NotFound from "./pages/NotFound";
import NotificationsPage from "./pages/NotificationsPage";
import AdminRoute from "./components/admin/AdminRoute";
import "./App.css";

const queryClient = new QueryClient();


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <React.Fragment>
          <BrandingProvider>
            <PreferencesProvider>
              <SubscriptionProvider>
                <AppProvider>
                  <SupabaseInitializer>
                    <AppInitializer>
                      <CriticalResourcePreloader />
                      <BrowserRouter>
                      <Routes>
        <Route path="/" element={<OptimizedLandingPage />} />
        <Route path="/dashboard" element={<Index />} />
        <Route path="/landing" element={<OptimizedLandingPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/register/:planType" element={<RegisterWithPlanPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/transactions" element={<TransactionsPage />} />
                        <Route path="/expenses" element={<ExpensesPage />} />
                        <Route path="/goals" element={<GoalsPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/schedule" element={<SchedulePage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
                        <Route path="/checkout/change-plan" element={<PlanChangeCheckoutPage />} />
                        <Route path="/payment-confirmation" element={<PaymentConfirmationPage />} />
                        <Route path="/payment-success" element={<PaymentSuccessPage />} />
                        <Route path="/thank-you" element={<ThankYouPage />} />
                        <Route path="/achievements" element={<AchievementsPage />} />
                        <Route path="/terms" element={<TermsPage />} />
                        <Route path="/privacy" element={<PrivacyPage />} />
                        <Route 
                          path="/admin" 
                          element={
                            <AdminRoute>
                              <AdminDashboard />
                            </AdminRoute>
                          } 
                        />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </BrowserRouter>
                    <Toaster />
                    <Sonner />
                    </AppInitializer>
                  </SupabaseInitializer>
                </AppProvider>
              </SubscriptionProvider>
            </PreferencesProvider>
          </BrandingProvider>
        </React.Fragment>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
