/* eslint-disable react-native/no-inline-styles */
/* eslint-disable no-catch-shadow */
import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, Alert, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
// import styles from './Style/Loginstyle';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
//import { LoginManager, AccessToken } from 'react-native-fbsdk-next';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import { useDispatch, useSelector } from 'react-redux';
import { setIdToken, setUserId } from './authSlice';
import messaging from '@react-native-firebase/messaging';
import Icon from 'react-native-vector-icons/FontAwesome'; 

function Login() {
  const idToken = useSelector((state: any) => state.auth.idToken);
  console.log(idToken);


  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation();
  const dispatch = useDispatch();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '674795343310-v0bs68cmaafjg2ts8bakkipcsveo9oo7.apps.googleusercontent.com',
    });

  }, []);
  const getFCMToken = async () => {
    try {
      const fcmToken = await messaging().getToken();
      return fcmToken;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  };


  const isValidEmail = (email) => /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid Gmail address.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      console.log('User Login Successful:', user);

      const userDoc = await firestore().collection('users').doc(user.uid).get();

      if (userDoc.exists) {
        navigation.navigate('Home');
      } else {
        await firestore().collection('users').doc(user.uid).set({
          email: user.email,
          userId: user.uid,
          name: user.name,

        });
        navigation.navigate('FeedScreen');
      }
    } catch (err) {
      console.error('Login Error:', err);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleButtonPress = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Checking Play Services...');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // console.log('Initiating Google Sign-In...');
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign-In Success:', JSON.stringify(userInfo, null, 2));
      const userId = userInfo.data?.user.id;
      console.log('User ID:', userId);
      const idToken = userInfo.data?.idToken;
      // console.log('ID Token:', idToken);

      console.log('Signing in with Firebase...');
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const firebaseUser = await auth().signInWithCredential(googleCredential);
      // console.log('Firebase Sign-In Success:', firebaseUser.user.uid);

      const userDoc = await firestore().collection('users').doc(userId).get();
      // console.log('User Doc Exists:', userDoc.exists);

      if (userDoc.exists) {
        dispatch(setIdToken(idToken));
        dispatch(setUserId(userId));
        const fcmToken = await getFCMToken();
        console.log('FCM Token:', fcmToken);
        navigation.navigate('Home', {
          name: userDoc.data()?.name,
          userId: userId, // or: userDoc.data()?.userId if you're reading it from the document
        });
      } else {
        console.log('Creating new user document...');
        await firestore().collection('users').doc(userId).set({
          email: userInfo.data?.user.email,
          userId,
          name: userInfo.data?.user.name,
          profilepic: userInfo.data?.user.photo,
          posts: [],
        });
        // navigation.navigate('UsersList', { name: userInfo.data?.user.name });
        navigation.navigate('Home', {
          name: userInfo.data?.user.name,
          userId: userInfo.data?.user.id, // or: userDoc.data()?.userId if you're reading it from the document
        });

      }
    } catch (error) {
      console.error('Google Sign-In Error:', JSON.stringify(error, null, 2));
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        setError('Sign-In was cancelled. Please try again.');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        setError('Sign-In is already in progress.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services are not available or outdated.');
      } else {
        setError(`Google Sign-In failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      {/* Email Input */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#8e8e8e"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      {/* Password Input */}
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#8e8e8e"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {/* Login Button */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: loading ? '#3d3d29' : '#3d3d29' }]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
      {/* Sign Up or Sign In Link */}
      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Do you have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.signupLink}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.divider}>OR</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: loading ? ' #3d3d29' : '#3d3d29' }]}
        onPress={onGoogleButtonPress}
      >
        <View style={{flexDirection:'row'}}>
        <Icon name="google" size={24} color="#fff" />

        <Text style={styles.buttonText}>Sign In with Google</Text>


        </View>
      </TouchableOpacity>
      {/* <TouchableOpacity
        style={[styles.button, { backgroundColor: 'black' }]}
        onPress={onGoogleButtonPress}
      >
        <View style={styles.googleIconContainer}>
          <Icon name="google" size={24} color="#fff" />
        </View>
      </TouchableOpacity> */}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export default Login;
const styles = StyleSheet.create({
  // Add your styles here
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
    
  },
  input: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    marginBottom: 15,
    paddingLeft: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    color: 'black',
    borderColor:'black',
    borderWidth: 1, // ✅ Added to make border visible

  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    borderColor:'white',
    borderWidth: 2, // ✅ Added to make border visible
  },
  buttonText: {
    paddingLeft:10,
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  divider: {
    fontSize: 16,
    marginVertical: 15,
    color: 'black',
  },
  errorText: {
    color: 'red',
    marginTop: 10,
    fontSize: 14,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  signupContainer: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
  },
  signupText: {
    fontSize: 16,
    color: '#333',
  },
  signupLink: {
    color: 'blue', // Link style for Sign Up
    fontWeight: 'bold',
  },
  googleIcon: {
    marginRight: 10, // Add space between the icon and text
  },
  googleIconContainer: {
    width: 50, // Set the size of the circle
    height: 50,
    borderRadius: 25, // This makes the container circular
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black', // Google Blue color
  },


});