#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();

const int motorCount = 15;

void setup() {
  Serial.begin(115200);
  pwm.begin();
  pwm.setPWMFreq(1600); 

  for (int i = 0; i < motorCount; i++) {
    pwm.setPWM(i, 0, 0);
  }
  
  Serial.println("SYSTEM_READY");
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input.length() == 0) return;

    if (input.startsWith("M")) {
      int colonIdx = input.indexOf(':');
      if (colonIdx > 0) {
        int motorId = input.substring(1, colonIdx).toInt();
        int speed = input.substring(colonIdx + 1).toInt();
        if (motorId >= 0 && motorId < 16) {
          pwm.setPWM(motorId, 0, speed);
        }
      }
    } else if (input == "STOP") {
      for (int i = 0; i < 16; i++) {
        pwm.setPWM(i, 0, 0);
      }
    }
  }
}
