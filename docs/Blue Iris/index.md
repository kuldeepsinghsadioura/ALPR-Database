### Set up an alert action within Blue Iris:

ALPR recognitions are sent to the `api/plate-reads` endpoint.

We can make use of the built-in macros to dynamically get the alert data and send it as our payload. It should look like this:

    { "plate_number":"&PLATE", "Image":"&ALERT_JPEG", "camera":"&CAM", "ALERT_PATH": "&ALERT_PATH", "ALERT_CLIP": "&ALERT_CLIP", "timestamp":"&ALERT_TIME" }

**Set your API key with the x-api-key header as seen below.**
![enter image description here](https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/Images/blueiris.png)

Note: The &PLATE macro will only send one plate number per alert. If you need to detect multiple plates in a single alert/image, you can optionally use the memo instead of the plate number. Your payload should look like this:

    { "memo":"&MEMO", "Image":"&ALERT_JPEG", "camera":"&CAM", "timestamp":"&ALERT_TIME" }
