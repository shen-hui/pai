# Webportal section parser

- [Default Configuration](#D_Config)
- [How to Configure](#HT_Config)
- [Generated Configuration](#G_Config)
- [Data Table](#T_config)

## Default configuration <a name="D_Config"></a>

[webportal default configuration](webportal.yaml)

## How to configure webportal section in service-configuration.yaml <a name="HT_Config"></a>

All configurations in this section is optional. If you want to customized these value, you can configure it in service-configuration.yaml.

For example, if you want to use different port than the default 9286, add following to your service-configuration.yaml as following:

```yaml
webportal:
    server-port: new-value
```

About config the web portal plugin, see [here](https://openpai.readthedocs.io/en/latest/manual/cluster-admin/how-to-customize-cluster-by-plugins.html)

## Generated Configuration <a name="G_Config"></a>

After parsing, object model looks like:

```yaml
webportal:
    server-port: 9286
    uri: "http://master_ip:9286"
```

## Table <a name="T_Config"></a>

<table>
<tr>
    <td>Data in Configuration File</td>
    <td>Data in Cluster Object Model</td>
    <td>Data in Jinja2 Template</td>
    <td>Data type</td>
</tr>
<tr>
    <td>webportal.server-port</td>
    <td>com["webportal"]["server-port"]</td>
    <td>cluster_cfg["webportal"]["server-port"]</td>
    <td>Int</td>
</tr>
<tr>
    <td>webportal.uri</td>
    <td>com["webportal"]["uri"]</td>
    <td>cluster_cfg["webportal"]["uri"]</td>
    <td>URL</td>
</tr>
</table>
