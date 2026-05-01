#!/usr/bin/env python3
"""
冷链数据采集器
支持硬件模式和本地 mock 模式。
"""

from datetime import datetime, timezone
import math
import os
import random
import time
from typing import Any, Dict, Optional, Tuple

import requests

try:
    import board
    import adafruit_dht
except ImportError:
    board = None
    adafruit_dht = None


def parse_bool(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000/api/sensor/data")
DEVICE_ID = os.getenv("DEVICE_ID", "sensor_001")
UPLOAD_INTERVAL = int(os.getenv("UPLOAD_INTERVAL", "30"))
SENSOR_MOCK_MODE = parse_bool(os.getenv("SENSOR_MOCK_MODE"), default=True)
DHT_PIN_NAME = os.getenv("DHT_PIN", "D4")


def resolve_pin() -> Any:
    if board is None:
        return None
    return getattr(board, DHT_PIN_NAME, None)


def create_sensor_context() -> Tuple[Any, bool]:
    if SENSOR_MOCK_MODE:
        return None, True

    if board is None or adafruit_dht is None:
        print("未检测到硬件依赖，自动回退到 mock 模式。")
        return None, True

    pin = resolve_pin()
    if pin is None:
        print(f"无效的 DHT 引脚配置: {DHT_PIN_NAME}，自动回退到 mock 模式。")
        return None, True

    try:
        return adafruit_dht.DHT11(pin), False
    except Exception as exc:
        print(f"初始化传感器失败，自动回退到 mock 模式: {exc}")
        return None, True


def mock_temperature_humidity() -> Dict[str, float]:
    timestamp = time.time() / 60.0
    temperature = 5.5 + math.sin(timestamp / 2.0) * 2.8 + random.uniform(-0.4, 0.4)
    humidity = 78.0 + math.cos(timestamp / 2.7) * 9.0 + random.uniform(-1.5, 1.5)
    return {
        "temperature": round(temperature, 1),
        "humidity": round(humidity, 1),
    }


def read_temperature_humidity(sensor_device: Any, use_mock: bool) -> Optional[Dict[str, float]]:
    if use_mock:
        return mock_temperature_humidity()

    try:
        temperature = sensor_device.temperature
        humidity = sensor_device.humidity
        if temperature is None or humidity is None:
            return None
        return {
            "temperature": float(temperature),
            "humidity": float(humidity),
        }
    except Exception as exc:
        print(f"读取温湿度失败: {exc}")
        return None


def read_gpio_status() -> Dict[str, int]:
    return {"gpio_1": 0, "gpio_2": 1}


def collect_data(sensor_device: Any, use_mock: bool) -> Dict[str, Any]:
    data: Dict[str, Any] = {
        "device_id": DEVICE_ID,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sensors": {},
    }

    th_data = read_temperature_humidity(sensor_device, use_mock)
    if th_data:
        data["sensors"]["temperature"] = th_data["temperature"]
        data["sensors"]["humidity"] = th_data["humidity"]

    data["sensors"].update(read_gpio_status())
    return data


def upload_data(data: Dict[str, Any], retries: int = 3) -> bool:
    for attempt in range(1, retries + 1):
        try:
            response = requests.post(SERVER_URL, json=data, timeout=10)
            if response.status_code == 200:
                print(f"数据上传成功: {data['timestamp']}")
                return True
            print(f"数据上传失败: HTTP {response.status_code}")
        except requests.RequestException as exc:
            print(f"上传错误(第 {attempt} 次): {exc}")

        if attempt < retries:
            time.sleep(attempt)

    return False


def main() -> None:
    sensor_device, use_mock = create_sensor_context()

    print("=" * 50)
    print("冷链数据采集器启动")
    print(f"设备ID: {DEVICE_ID}")
    print(f"上传地址: {SERVER_URL}")
    print(f"上传间隔: {UPLOAD_INTERVAL}秒")
    print(f"运行模式: {'MOCK' if use_mock else 'HARDWARE'}")
    print("=" * 50)

    while True:
        try:
            data = collect_data(sensor_device, use_mock)
            print(f"\n[{data['timestamp']}]")
            print(f"  温度: {data['sensors'].get('temperature', 'N/A')}°C")
            print(f"  湿度: {data['sensors'].get('humidity', 'N/A')}%")
            upload_data(data)
            time.sleep(UPLOAD_INTERVAL)
        except KeyboardInterrupt:
            print("\n采集器停止")
            break
        except Exception as exc:
            print(f"运行错误: {exc}")
            time.sleep(5)


if __name__ == "__main__":
    main()
