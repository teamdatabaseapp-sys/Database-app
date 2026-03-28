import React from 'react';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none', height: 0 },
        sceneStyle: { overflow: 'hidden' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ClientFlow',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null, // Hide this tab
        }}
      />
    </Tabs>
  );
}
