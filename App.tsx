import React, { useEffect, useState } from "react";
import "react-native-reanimated";
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Provider } from "react-redux";
import { store } from "./src/Store";

import Login from "./src/Login";
import Signup from "./src/Signup";
import Home from "./src/Home";
import Homess from "./src/OCR";
import Homes from "./src/Homes";
import History from "./src/History";
import Category from "./src/Category";
import OCRResultScreen from "./src/OCRResultScreen";
import OCR from "./src/OCR";

import auth from "@react-native-firebase/auth";
import SplashScreen from "react-native-splash-screen";
import Toast from "react-native-toast-message";
import Icon from "react-native-vector-icons/Ionicons";
import PushNotification from "react-native-push-notification";
import moment from "moment";
import ReactNativeBiometrics from "react-native-biometrics"; // Add this import

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {this.state.error?.toString()}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const AuthStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HomeStackNavigator = () => (
  <HomeStack.Navigator>
    <HomeStack.Screen name="OCR" component={OCR} options={{ headerShown: false }} />
    <HomeStack.Screen name="Homes" component={Homes} options={{ headerShown: false }} />
    <HomeStack.Screen name="History" component={History} />
    <HomeStack.Screen name="Category" component={Category} />
  </HomeStack.Navigator>
);

const AuthStackNavigator = () => (
  <AuthStack.Navigator>
    <AuthStack.Screen name="Login" component={Login} options={{ headerShown: false }} />
    <AuthStack.Screen name="Signup" component={Signup} options={{ headerShown: false }} />
  </AuthStack.Navigator>
);

const AppTabNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#007bff",
      tabBarInactiveTintColor: "#888",
      tabBarStyle: { backgroundColor: "#fff" },
    }}
  >
    <Tab.Screen
      name="Home"
      component={Home}
      options={{
        tabBarIcon: ({ color, size }) => <Icon name="home-outline" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="Add Expences"
      component={HomeStackNavigator}
      options={{
        tabBarIcon: ({ color, size }) => <Icon name="grid-outline" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="Category"
      component={Category}
      options={{
        tabBarIcon: ({ color, size }) => <Icon name="list-outline" size={size} color={color} />,
      }}
    />
  </Tab.Navigator>
);

function App(): React.JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(false); // Track biometric auth state

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
      SplashScreen.hide();
    });

    setupNotifications();
    scheduleFridayNotification();
    checkBiometricAuthentication(); // Check biometric auth after splash screen

    return unsubscribe;
  }, []);



  const setupNotifications = () => {
    PushNotification.configure({
      onNotification: function (notification) {
        console.log("LOCAL NOTIFICATION:", notification);
      },
      requestPermissions: Platform.OS === "ios",
      popInitialNotification: true,
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
    });

    PushNotification.createChannel(
      {
        channelId: "summary-channel",
        channelName: "Weekly Summary Channel",
        channelDescription: "Channel for weekly expense summaries",
        importance: 4,
        vibrate: true,
        soundName: "default",
      },
      (created) => console.log(`createChannel returned '${created}'`)
    );
  };

  const scheduleFridayNotification = () => {
    const now = moment();
    let nextFriday = now.clone().day(5); // 5 represents Friday

    // If it's already Friday and past the scheduled time, schedule for next Friday
    if (nextFriday.isSame(now, 'day') && now.hour() >= 13) {
      nextFriday.add(1, 'week');
    } else if (nextFriday.isBefore(now)) {
      nextFriday.add(1, 'week');
    }

    // Set the time to 1:00 PM
    nextFriday.set({ hour: 13, minute: 4, second: 0, millisecond: 0 });

    // Cancel any existing notifications
    PushNotification.cancelAllLocalNotifications();

    // Schedule the new notification
    PushNotification.localNotificationSchedule({
      channelId: "summary-channel",
      title: "Weekly Expense Summary",
      message: "Check out your total expenses for this week 📊",
      date: nextFriday.toDate(),
      allowWhileIdle: true,
      repeatType: 'week',
      repeatTime: 1,
      largeIcon: "ic_launcher",
      smallIcon: "ic_notification",
      importance: 'high',
      priority: 'high',
      vibrate: true,
      vibration: 300,
      playSound: true,
      soundName: 'default',
    });

    console.log(`Notification scheduled for ${nextFriday.format("MMMM Do YYYY, h:mm:ss a")}`);
  };

  const checkBiometricAuthentication = async () => {
    const rnBiometrics = new ReactNativeBiometrics();

    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    if (available && biometryType !== ReactNativeBiometrics.Biometrics) {
      const { success } = await rnBiometrics.simplePrompt({ promptMessage: "Confirm your identity" });
      if (success) {
        setBiometricAuthenticated(true); // Set to true on success
      } else {
        console.log("Biometric authentication failed or canceled");
        // Handle failure or redirect to another screen (e.g., login)
      }
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!biometricAuthenticated) {
    // If not authenticated, show a fallback view or redirect to another screen.
    return (
      <View style={styles.loadingContainer}>
        <Text>Biometric Authentication Required</Text>
      </View>
    );
  }

  return (
    <Provider store={store}>
      <ErrorBoundary>
        <NavigationContainer>
          {isAuthenticated ? <AppTabNavigator /> : <AuthStackNavigator />}
        </NavigationContainer>
      </ErrorBoundary>
      <Toast />
    </Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  errorText: {
    color: "red",
    fontSize: 16,
  },
});

export default App;
