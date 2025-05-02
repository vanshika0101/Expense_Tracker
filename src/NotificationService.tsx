// src/NotificationService.ts
import PushNotification from 'react-native-push-notification';
import AsyncStorage from '@react-native-async-storage/async-storage';

PushNotification.configure({
  onNotification: function (notification) {
    console.log("NOTIFICATION:", notification);
  },
  requestPermissions: true,
});

export const createNotificationChannel = () => {
  PushNotification.createChannel(
    {
      channelId: 'weekly-summary',
      channelName: 'Weekly Summary Channel',
    },
    (created) => console.log(`createChannel returned '${created}'`)
  );
};

const getNextSundayAt9AM = (): Date => {
  const now = new Date();
  const day = now.getDay();
  const diff = (7 - day) % 7;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + diff);
  nextSunday.setHours(9, 0, 0, 0);
  return nextSunday;
};

export const scheduleWeeklyNotification = async () => {
  const expensesRaw = await AsyncStorage.getItem('expenses');
  const expenses = expensesRaw ? JSON.parse(expensesRaw) : [];

  const thisWeekExpenses = expenses.filter(e => isSameWeek(e.date));
  const total = thisWeekExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const message = `You spent ₹${total.toFixed(2)} this week. Keep it up!`;

  PushNotification.localNotificationSchedule({
    channelId: 'weekly-summary',
    title: 'Weekly Expense Summary',
    message,
    date: getNextSundayAt9AM(),
    repeatType: 'week',
    allowWhileIdle: true,
  });
};

const isSameWeek = (dateStr: string) => {
  const [day, month, year] = dateStr.split('/');
  const date = new Date(+year, +month - 1, +day);

  const now = new Date();
  const startOfWeek = new Date(now);
  const dayOfWeek = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return date >= startOfWeek && date <= endOfWeek;
};
