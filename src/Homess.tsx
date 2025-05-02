import React, { useState } from 'react';
import {
  View,
  Button,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Alert,
  ActionSheetIOS,
  TouchableOpacity,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';

interface NavigationProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
  };
}

const Homess = ({ navigation }: NavigationProps) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState('');

  const requestAndroidPermissions = async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
    }
  };

  const openImagePicker = async (fromCamera: boolean) => {
    await requestAndroidPermissions();

    const result = fromCamera
      ? await launchCamera({ mediaType: 'photo' })
      : await launchImageLibrary({ mediaType: 'photo' });

    if (result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      if (typeof uri === 'string') {
        setImageUri(uri);
        setRecognizedText('');
      }
    } else {
      console.log('No image selected');
    }
  };

  const showImagePickerOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) openImagePicker(true);
          else if (buttonIndex === 2) openImagePicker(false);
        }
      );
    } else {
      Alert.alert(
        'Select Image Source',
        '',
        [
          { text: 'Camera', onPress: () => openImagePicker(true) },
          { text: 'Gallery', onPress: () => openImagePicker(false) },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
    }
  };

  const extractMerchantName = (text: string): string => {
    // Convert to uppercase for consistent matching
    text = text.toUpperCase();
    
    // Common patterns for merchant names
    const patterns = [
        // Business name patterns
        /(?:AT|FROM|MERCHANT|STORE|SHOP|BILL FROM):?\s*([A-Z\s]+(?:VISION|STORE|SHOP|MART|SUPERMARKET|BAZAAR|MARKET|CENTER|WORLD|PLAZA|MALL|COMPANY|ENTERPRISES|TRADERS|TRADING|SERVICES|SOLUTIONS|TECHNOLOGIES|SYSTEMS|PVT\.? LTD\.?|LLP|LLC|INC\.?|CORP\.?|CO\.?|LTD\.?))/i,
        /([A-Z\s]+(?:VISION|STORE|SHOP|MART|SUPERMARKET|BAZAAR|MARKET|CENTER|WORLD|PLAZA|MALL|COMPANY|ENTERPRISES|TRADERS|TRADING|SERVICES|SOLUTIONS|TECHNOLOGIES|SYSTEMS|PVT\.? LTD\.?|LLP|LLC|INC\.?|CORP\.?|CO\.?|LTD\.?))\s*(?:BILL|RECEIPT|INVOICE|RS|₹|\d)/i,
        
        // Generic patterns
        /(?:AT|FROM|MERCHANT|STORE|SHOP|BILL FROM):?\s*([A-Z\s]+)/i,
        /([A-Z\s]+)\s*(?:BILL|RECEIPT|INVOICE|RS|₹|\d)/i
    ];

    // Try each pattern
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            // Clean up the merchant name
            let merchant = match[1].trim();
            // Remove any trailing special characters and common suffixes
            merchant = merchant.replace(/[^\w\s-]+$/, '')
                             .replace(/\s+(?:AUTHORISED|AUTHORIZED|SIGNATORY|SIGNATURE|BILL|RECEIPT|INVOICE)$/i, '')
                             .trim();
            
            // If we have a valid merchant name, return it
            if (merchant.length > 1) {
                return merchant;
            }
        }
    }

    // If no pattern matches, try to find the first line that doesn't contain numbers
    const lines = text.split('\n');
    for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine.match(/\d/) && cleanLine.length > 1) {
            return cleanLine;
        }
    }

    return 'Unknown Merchant';
  };

  const processAndNavigate = async () => {
    try {
      if (!imageUri) {
        Alert.alert('Error', 'No image selected');
        return;
      }

      const result = await TextRecognition.recognize(imageUri);
      const txt = result.text;
      console.log('Recognized Text:', txt);

      if (!txt || txt.trim().length === 0) {
        Alert.alert('Image Unclear', 'No text found. Try a clearer image.');
        return;
      }

      // Extract amount
      const regex = /\d{1,3}(,\d{3})*(\.\d{1,2})?|\d+(\.\d{1,2})?/g;
      const numbers = txt.match(regex);
      const lastNumber = numbers ? numbers[numbers.length - 1].replace(/,/g, '') : '';

      // Extract merchant name
      const merchantName = extractMerchantName(txt);
      console.log('Extracted Merchant:', merchantName);

      setRecognizedText(`Merchant: ${merchantName}\nAmount: ${lastNumber}`);
      navigation.navigate('Homes', { 
        amount: lastNumber,
        merchant: merchantName 
      });

    } catch (error) {
      console.error('OCR error:', error);
      Alert.alert('Error', 'Failed to extract text from image.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {!imageUri && (
        <>
          <TouchableOpacity style={styles.button} onPress={showImagePickerOptions}>
            <Text style={styles.buttonText}>📷 Select Image</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.manualButton]} 
            onPress={() => navigation.navigate('Homes', { amount: '' })}
          >
            <Text style={styles.buttonText}>✏️ Enter Amount Manually</Text>
          </TouchableOpacity>
        </>
      )}

      {imageUri && (
        <>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          <TouchableOpacity style={styles.button} onPress={processAndNavigate}>
            <Text style={styles.buttonText}>💾 Save and Continue</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 30,
  },
  image: {
    width: '90%',
    height: 300,
    marginVertical: 20,
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 16,
    color: '#333',
    marginTop: 15,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  manualButton: {
    backgroundColor: '#2196F3', // Different color for manual entry
    marginTop: 10,
  },
});

export default Homess;
