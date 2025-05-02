import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const OCRResultScreen = ({ route }) => {
  const { imageUri, recognizedText } = route.params;

  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} />
      <Text style={styles.text}>{recognizedText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 300,
    height: 300,
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
});

export default OCRResultScreen;
