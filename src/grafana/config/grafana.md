## Grafana section parser

- [Default Configuration](#D_Config)
- [How to Configure](#HT_Config)
- [Generated Configuration](#G_Config)
- [Data Table](#T_config)

#### Default configuration <a name="D_Config"></a>

[grafana default configuration](grafana.yaml)

#### How to configure cluster section in service-configuration.yaml <a name="HT_Config"></a>

All configurations in this section is optional. If you want to customized these value, you can configure it in service-configuration.yaml.

For example, if you want to use different port than the default 3000, add following to your service-configuration.yaml as following:
```yaml
grafana:
    port: new-value
```

#### Generated Configuration <a name="G_Config"></a>

After parsing, object model looks like:
```yaml
grafana:
    port: 3000
    url: "http://master_ip:3000"
```


#### Table <a name="T_Config"></a>

<table>
<tr>
    <td>Data in Configuration File</td>
    <td>Data in Cluster Object Model</td>
    <td>Data in Jinja2 Template</td>
    <td>Data type</td>
</tr>
<tr>
    <td>grafana.port</td>
    <td>com["grafana"]["port"]</td>
    <td>cluster_cfg["grafana"]["port"]</td>
    <td>Int</td>
</tr>
<tr>
    <td>grafana.url</td>
    <td>com["grafana"]["url"]</td>
    <td>cluster_cfg["grafana"]["url"]</td>
    <td>URL</td>
</tr>
</table>
